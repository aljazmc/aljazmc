import type { Node } from "@aljazmc/syntax";
import type Context from "../../analysis/context.js";
import type { Range } from "../../analysis/context.js";
import { rule } from "../../rules.js";

/** The `?.` of the outermost optional link of a chain, which short-circuits it. */
const optional = (context: Context, node: Node): Range | undefined => {
    let current = node;
    for (;;) {
        if (current.type === "MemberExpression") {
            if (current.optional) return context.find("?.", current.object.end);
            if (current.object.parenthesized) return;
            current = current.object;
        } else if (current.type === "CallExpression") {
            if (current.optional) return context.find("?.", current.callee.end);
            if (current.callee.parenthesized) return;
            current = current.callee;
        } else if (
            current.type === "TSNonNullExpression" &&
            !current.expression.parenthesized
        )
            current = current.expression;
        else return;
    }
};

/** The `?.` that makes a value possibly undefined, through `&&`, `||`, `??` and the like. */
const undefinedBy = (context: Context, node: Node): Range | undefined => {
    switch (node.type) {
        case "LogicalExpression":
            return node.operator === "&&"
                ? (undefinedBy(context, node.left) ??
                      undefinedBy(context, node.right))
                : undefinedBy(context, node.right);
        case "ConditionalExpression":
            return (
                undefinedBy(context, node.consequent) ??
                undefinedBy(context, node.alternate)
            );
        case "AwaitExpression":
            return undefinedBy(context, node.argument);
        case "SequenceExpression":
            return undefinedBy(context, node.expressions.at(-1) as Node);
        case "TSAsExpression":
        case "TSSatisfiesExpression":
        case "TSNonNullExpression":
            return undefinedBy(context, node.expression);
        default:
            return optional(context, node);
    }
};

export default rule({
    name: "noUnsafeOptionalChaining",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => {
        const check = (node: Node | null | undefined) => {
            const range = node && undefinedBy(context, node);
            if (range)
                context.report(range, "Unsafe usage of optional chaining.");
        };
        /** Chains continued after parentheses, `(a?.b).c`, do not short-circuit. */
        const checkWrapped = (node: Node) => {
            if (node.parenthesized || node.type !== "MemberExpression")
                check(node);
        };
        return {
            BinaryExpression(node) {
                if (node.operator === "in" || node.operator === "instanceof")
                    check(node.right);
            },
            WithStatement(node) {
                check(node.object);
            },
            ForOfStatement(node) {
                check(node.right);
            },
            VariableDeclarator(node) {
                if (
                    node.id.type === "ObjectPattern" ||
                    node.id.type === "ArrayPattern"
                )
                    check(node.init);
            },
            AssignmentExpression(node) {
                if (
                    node.operator === "=" &&
                    (node.left.type === "ObjectPattern" ||
                        node.left.type === "ArrayPattern")
                )
                    check(node.right);
            },
            MemberExpression(node) {
                if (!node.optional && node.object.parenthesized)
                    checkWrapped(node.object);
            },
            CallExpression(node) {
                if (!node.optional && node.callee.parenthesized)
                    checkWrapped(node.callee);
                for (const argument of node.arguments)
                    if (argument.type === "SpreadElement")
                        check(argument.argument);
            },
            NewExpression(node) {
                check(node.callee);
            },
            TaggedTemplateExpression(node) {
                check(node.tag);
            },
            ArrayExpression(node) {
                for (const element of node.elements)
                    if (element?.type === "SpreadElement")
                        check(element.argument);
            },
            ClassDeclaration(node) {
                check(node.superClass);
            },
            ClassExpression(node) {
                check(node.superClass);
            },
        };
    },
});
