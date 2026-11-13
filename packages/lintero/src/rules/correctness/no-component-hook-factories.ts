import type { Node } from "@aljazmc/syntax";
import Functions from "../../analysis/functions.js";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

const wrappers = ["memo", "forwardRef", "React.memo", "React.forwardRef"];

/** Whether a value defines a component or hook, like a function or `memo(...)`. */
const defines = (value: Node | null): boolean =>
    value !== null &&
    (value.type === "ArrowFunctionExpression" ||
        value.type === "FunctionExpression" ||
        (value.type === "CallExpression" &&
            wrappers.includes(Nodes.path(value.callee) ?? "")));

/**
 * The function a declaration, assignment or property defines, undefined for
 * `memo(...)` and `forwardRef(...)`, which define components whatever they wrap.
 */
const definedFunction = (node: Node): Node | undefined => {
    const value =
        node.type === "VariableDeclarator"
            ? node.init
            : node.type === "AssignmentExpression"
              ? node.right
              : node.type === "Property"
                ? node.value
                : node;
    if (value?.type === "CallExpression") return undefined;
    return value ?? undefined;
};

/**
 * Whether a function takes parameters like a component, like Biome's: props,
 * or props and `ref`, or none; with more it is no component.
 */
const componentParameters = (fn: Node | undefined): boolean => {
    if (
        fn?.type !== "FunctionDeclaration" &&
        fn?.type !== "FunctionExpression" &&
        fn?.type !== "ArrowFunctionExpression"
    )
        return true;
    const [, second, ...rest] = fn.params;
    return (
        second === undefined ||
        (rest.length === 0 &&
            second.type === "Identifier" &&
            second.name === "ref")
    );
};

export default rule({
    name: "noComponentHookFactories",
    group: "correctness",
    severity: "error",
    recommended: false,
    fix: "none",
    languages: ["js", "jsx"],
    domains: { react: "recommended" },
    create: (context) => {
        const check = (id: Node, node: Node) => {
            if (id.type !== "Identifier") return;
            const kind = Functions.component(id.name)
                ? "component"
                : Functions.hook(id.name)
                  ? "hook"
                  : undefined;
            if (!kind) return;
            // like Biome, a function expression on its own, returned or
            // passed, is a component by its name, whatever it takes
            if (
                kind === "component" &&
                node.type !== "FunctionExpression" &&
                !componentParameters(definedFunction(node))
            )
                return;
            const outer = Functions.enclosing(context, node);
            if (
                (outer?.type !== "FunctionDeclaration" &&
                    outer?.type !== "FunctionExpression" &&
                    outer?.type !== "ArrowFunctionExpression") ||
                Functions.method(context, outer)
            )
                return;
            // higher order components take components, like `withAuth(Wrapped)`
            const takesComponent = outer.params.some((param) => {
                const name =
                    param.type === "AssignmentPattern" ? param.left : param;
                return name.type === "Identifier" && /^[A-Z]/.test(name.name);
            });
            if (!takesComponent)
                context.report(
                    id,
                    `Do not define ${kind} ${id.name} inside a function.`,
                );
        };

        return {
            FunctionDeclaration(node) {
                if (node.id) check(node.id, node);
            },
            FunctionExpression(node) {
                // like Biome, a function that is a value goes by the name it
                // is given, `x = function Comp() {}` by `x`
                const parent = context.parent(node);
                const named =
                    parent?.type === "VariableDeclarator" ||
                    (parent?.type === "AssignmentExpression" &&
                        parent.right === node) ||
                    (parent?.type === "Property" && parent.value === node);
                if (node.id && !named) check(node.id, node);
            },
            Property(node) {
                // like Biome, `{ Comp: () => <div /> }` defines a component,
                // methods and hooks named by keys do not count
                if (
                    !node.computed &&
                    !node.method &&
                    node.kind === "init" &&
                    node.key.type === "Identifier" &&
                    Functions.component(node.key.name) &&
                    defines(node.value)
                )
                    check(node.key, node);
            },
            VariableDeclarator(node) {
                if (defines(node.init)) check(node.id, node);
            },
            AssignmentExpression(node) {
                if (node.operator === "=" && defines(node.right))
                    check(node.left, node);
            },
        };
    },
});
