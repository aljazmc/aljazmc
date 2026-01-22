import type { Node } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

export default rule({
    name: "useArrayLiterals",
    group: "style",
    severity: "info",
    recommended: true,
    fix: "safe",
    languages: ["js"],
    create: (context) => {
        const check = (node: Node & { callee: Node; arguments: Node[] }) => {
            const { callee } = node;
            if (
                callee.type !== "Identifier" ||
                callee.name !== "Array" ||
                !context.semantic.isGlobal(callee) ||
                (node.arguments.length === 1 &&
                    node.arguments[0]?.type !== "SpreadElement")
            )
                return;
            context.report(
                node,
                "Use an array literal instead of the Array constructor.",
            );
        };
        return { CallExpression: check, NewExpression: check };
    },
});
