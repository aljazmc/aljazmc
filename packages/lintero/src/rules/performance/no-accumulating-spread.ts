import type { Node } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noAccumulatingSpread",
    group: "performance",
    severity: "warn",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => {
        /** Whether an identifier is the accumulator parameter of a reduce callback around it. */
        const accumulator = (id: Node): boolean => {
            if (id.type !== "Identifier") return false;
            const binding = context.semantic.referenced(id)?.binding;
            const [declaration] = binding?.declarations ?? [];
            if (declaration?.kind !== "parameter") return false;
            const fn = declaration.node;
            if (
                fn.type !== "ArrowFunctionExpression" &&
                fn.type !== "FunctionExpression"
            )
                return false;
            if (fn.params[0] !== declaration.id) return false;
            const call = context.parent(fn);
            if (call?.type !== "CallExpression" || call.arguments[0] !== fn)
                return false;
            const name = Nodes.member(call.callee)?.name;
            return name === "reduce" || name === "reduceRight";
        };
        return {
            SpreadElement(node) {
                if (!accumulator(Nodes.unwrap(node.argument))) return;
                const parent = context.parent(node);
                if (
                    parent?.type === "ArrayExpression" ||
                    parent?.type === "ObjectExpression"
                )
                    context.report(
                        node,
                        "Avoid the use of spread (`...`) syntax on accumulators.",
                    );
            },
            CallExpression(node) {
                if (Nodes.path(node.callee) !== "Object.assign") return;
                const [target, ...sources] = node.arguments;
                if (target && Nodes.unwrap(target).type === "Identifier")
                    return;
                if (sources.some((source) => accumulator(Nodes.unwrap(source))))
                    context.report(
                        node,
                        "Avoid the use of Object.assign on accumulators.",
                    );
            },
        };
    },
});
