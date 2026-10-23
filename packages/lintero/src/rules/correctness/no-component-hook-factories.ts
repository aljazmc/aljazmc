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
                const parent = context.parent(node);
                if (node.id && parent?.type !== "VariableDeclarator")
                    check(node.id, node);
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
