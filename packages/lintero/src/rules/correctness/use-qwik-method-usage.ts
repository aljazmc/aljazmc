import type { Node } from "@aljazmc/syntax";
import Imports from "../../analysis/imports.js";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

export default rule({
    name: "useQwikMethodUsage",
    group: "correctness",
    severity: "error",
    recommended: false,
    fix: "none",
    languages: ["js"],
    domains: { qwik: "recommended" },
    create: (context) => {
        /** Whether a function is the callback of `component$(...)`. */
        const component = (fn: Node): boolean => {
            const parent = context.parent(fn);
            return (
                parent?.type === "CallExpression" &&
                parent.arguments[0] === fn &&
                Nodes.path(parent.callee) === "component$"
            );
        };
        /** Whether a function is a custom hook, `function useX() {}` or `const useX = () => {}`. */
        const hook = (fn: Node): boolean => {
            if (fn.type === "FunctionDeclaration")
                return (fn.id?.name ?? "").startsWith("use");
            const parent = context.parent(fn);
            return (
                fn.type === "ArrowFunctionExpression" &&
                parent?.type === "VariableDeclarator" &&
                parent.id.type === "Identifier" &&
                parent.id.name.startsWith("use")
            );
        };

        return {
            CallExpression(node) {
                const { callee } = node;
                if (
                    callee.type !== "Identifier" ||
                    !callee.name.startsWith("use") ||
                    Imports.of(context, callee)?.source !== "@builder.io/qwik"
                )
                    return;
                const functions = [...context.ancestors(node)].filter(
                    (ancestor) => Nodes.isFunction(ancestor),
                );
                const [closest] = functions;
                if (functions.some(component) || (closest && hook(closest)))
                    return;
                context.report(
                    node,
                    "Qwik hook detected outside of an allowed scope.",
                );
            },
        };
    },
});
