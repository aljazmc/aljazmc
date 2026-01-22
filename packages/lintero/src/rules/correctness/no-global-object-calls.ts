import type { Node } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

const objects = ["Atomics", "Intl", "JSON", "Math", "Reflect"];

export default rule({
    name: "noGlobalObjectCalls",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => {
        const check = (callee: Node) => {
            if (
                callee.type === "Identifier" &&
                objects.includes(callee.name) &&
                context.semantic.isGlobal(callee)
            )
                context.report(
                    callee,
                    `${callee.name} cannot be called as a function.`,
                );
        };
        return {
            CallExpression: (node) => check(node.callee),
            NewExpression: (node) => check(node.callee),
        };
    },
});
