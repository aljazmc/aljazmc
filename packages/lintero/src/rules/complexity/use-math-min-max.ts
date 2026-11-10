import type { Node, NodeOf } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import type { Binding } from "../../analysis/semantic.js";
import { rule } from "../../rules.js";

/** Whether a type annotation is `number` or `Number`. */
const numericType = (type: Node): boolean =>
    (type.type === "TSKeyword" && type.name === "number") ||
    (type.type === "TSTypeReference" && Nodes.path(type.typeName) === "Number");

/**
 * Strips `!` and assertions to numeric types, undefined for assertions to
 * other types, which say the value is not a number.
 */
const unwrap = (node: Node): Node | undefined => {
    if (node.type === "TSNonNullExpression") return unwrap(node.expression);
    if (node.type === "TSAsExpression" || node.type === "TSTypeAssertion")
        return numericType(node.typeAnnotation)
            ? unwrap(node.expression)
            : undefined;
    return node;
};

/** Whether a value is a literal that is not a number, like a string or an untagged template. */
const nonNumericLiteral = (node: Node): boolean =>
    node.type === "StringLiteral" ||
    node.type === "NullLiteral" ||
    node.type === "BooleanLiteral" ||
    node.type === "RegExpLiteral" ||
    node.type === "TemplateLiteral" ||
    (node.type === "NumericLiteral" && node.raw.endsWith("n"));

const isDate = (node: Node): boolean =>
    node.type === "NewExpression" && Nodes.path(node.callee) === "Date";

/** Whether a value is obviously not a number, like a string, a bigint or a date. */
const nonNumeric = (node: Node): boolean => {
    const value = unwrap(node);
    return (
        !value ||
        nonNumericLiteral(value) ||
        isDate(value) ||
        (value.type === "CallExpression" &&
            Nodes.path(value.callee) === "BigInt")
    );
};

/** Whether the declaration of a binding says it is not a number, by its type or its initial value. */
const nonNumericDeclaration = (binding: Binding): boolean => {
    const declaration = binding.declarations[0];
    if (!declaration) return false;
    const initial = (value: Node | null | undefined) =>
        !!value && (nonNumericLiteral(value) || isDate(value));
    const annotated = (id: Node) =>
        id.type === "Identifier" &&
        !!id.typeAnnotation &&
        !numericType(id.typeAnnotation);
    if (declaration.kind === "parameter") {
        const parameter = parameterOf(declaration.node, declaration.id);
        return (
            annotated(declaration.id) ||
            (parameter?.type === "AssignmentPattern" &&
                initial(parameter.right))
        );
    }
    const declarator = declaration.node;
    if (declarator.type !== "VariableDeclarator") return false;
    return annotated(declarator.id) || initial(declarator.init);
};

/** The parameter of a function that declares an identifier, with its default value. */
const parameterOf = (fn: Node, id: Node): Node | undefined =>
    Nodes.isFunction(fn)
        ? (fn as Node & { params: Node[] }).params.find(
              (param) =>
                  param === id ||
                  (param.type === "AssignmentPattern" && param.left === id),
          )
        : undefined;

type Call = NodeOf<"CallExpression">;

const isReduce = (call: Node | undefined): call is Call =>
    call?.type === "CallExpression" &&
    ["reduce", "reduceRight"].includes(Nodes.member(call.callee)?.name ?? "");

export default rule({
    name: "useMathMinMax",
    group: "complexity",
    severity: "warn",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    create: (context) => {
        const bindingOf = (node: Node): Binding | undefined => {
            const value = unwrap(node);
            return value?.type === "Identifier"
                ? context.semantic.referenced(value)?.binding
                : undefined;
        };
        const written = (binding: Binding) =>
            binding.references.some((reference) => reference.write);

        /** Whether a value, or the constant it reads, is not a number. */
        const nonNumericValue = (node: Node): boolean => {
            if (nonNumeric(node)) return true;
            const binding = bindingOf(node);
            return (
                !!binding && !written(binding) && nonNumericDeclaration(binding)
            );
        };

        /** The array literal a `reduce()` call reduces, also through a constant used only by reductions. */
        const reducedArray = (call: Call) => {
            const member = Nodes.member(call.callee);
            if (!member || call.callee.type !== "MemberExpression") return;
            const receiver = Nodes.unwrap(call.callee.object);
            if (receiver.type === "ArrayExpression") return receiver;
            if (receiver.type !== "Identifier") return;
            const binding = context.semantic.referenced(receiver)?.binding;
            const declaration = binding?.declarations[0];
            if (
                !binding ||
                binding.exported ||
                written(binding) ||
                declaration?.kind !== "const" ||
                declaration.node.type !== "VariableDeclarator" ||
                declaration.node.id !== declaration.id ||
                !binding.references.every((reference) => {
                    const parent = context.parent(reference.node);
                    return (
                        parent?.type === "MemberExpression" &&
                        Nodes.unwrap(parent.object) === reference.node &&
                        isReduce(context.parent(parent)) &&
                        (context.parent(parent) as { callee: Node }).callee ===
                            parent
                    );
                })
            )
                return;
            const init =
                declaration.node.init && Nodes.unwrap(declaration.node.init);
            return init?.type === "ArrayExpression" ? init : undefined;
        };

        /**
         * Whether an operand is the accumulator or the item of a `reduce()`
         * callback over values that are not numbers, like
         * `["a", "b"].reduce((a, b) => (a > b ? a : b))`.
         */
        const nonNumericReduction = (node: Node): boolean => {
            const binding = bindingOf(node);
            const declaration = binding?.declarations[0];
            if (
                !binding ||
                written(binding) ||
                declaration?.kind !== "parameter"
            )
                return false;
            const callback = declaration.node;
            if (
                callback.type !== "ArrowFunctionExpression" &&
                callback.type !== "FunctionExpression"
            )
                return false;
            const index = callback.params.findIndex(
                (param) =>
                    param === declaration.id ||
                    (param.type === "AssignmentPattern" &&
                        param.left === declaration.id),
            );
            if (index < 0 || index > 1) return false;
            const call = context.parent(callback);
            if (
                !isReduce(call) ||
                !call.arguments[0] ||
                Nodes.unwrap(call.arguments[0]) !== callback
            )
                return false;
            const array = reducedArray(call);
            if (!array) return false;
            const anyElement = () =>
                array.elements.some(
                    (element) =>
                        !!element &&
                        element.type !== "SpreadElement" &&
                        nonNumericValue(element),
                );
            const initial = call.arguments[1];
            if (index === 0 && initial)
                return (
                    initial.type !== "SpreadElement" && nonNumericValue(initial)
                );
            return anyElement();
        };

        return {
            ConditionalExpression(node) {
                const { test, consequent, alternate } = node;
                if (
                    test.type !== "BinaryExpression" ||
                    !["<", "<=", ">", ">="].includes(test.operator)
                )
                    return;
                const { left, right } = test;
                if (
                    [left, right].some(
                        (operand) =>
                            nonNumericValue(operand) ||
                            nonNumericReduction(operand),
                    )
                )
                    return;
                let picksLeft: boolean;
                if (
                    Nodes.same(consequent, left) &&
                    Nodes.same(alternate, right)
                )
                    picksLeft = true;
                else if (
                    Nodes.same(consequent, right) &&
                    Nodes.same(alternate, left)
                )
                    picksLeft = false;
                else return;
                // a > b ? a : b picks the larger one
                const larger = test.operator.startsWith(">") === picksLeft;
                const fn = larger ? "max" : "min";
                context.report(
                    node,
                    `This ternary is selecting the ${larger ? "larger" : "smaller"} of the same two operands, which can be simplified.`,
                    {
                        message: `Use Math.${fn}() instead.`,
                        edits: [
                            {
                                start: node.start,
                                end: node.end,
                                text: `Math.${fn}(${context.slice(context.outer(left))}, ${context.slice(context.outer(right))})`,
                            },
                        ],
                    },
                );
            },
        };
    },
});
