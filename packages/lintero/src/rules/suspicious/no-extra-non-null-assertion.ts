import type { Node } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

export default rule({
    name: "noExtraNonNullAssertion",
    group: "suspicious",
    severity: "warn",
    recommended: true,
    fix: "safe",
    languages: ["ts"],
    create: (context) => {
        const report = (assertion: Node) =>
            context.report(assertion, "Forbidden extra non-null assertion.", {
                message: "Remove extra non-null assertion.",
                edits: [
                    { start: assertion.end - 1, end: assertion.end, text: "" },
                ],
            });
        return {
            TSNonNullExpression(node) {
                if (node.expression.type === "TSNonNullExpression")
                    report(node);
            },
            MemberExpression(node) {
                if (node.optional && node.object.type === "TSNonNullExpression")
                    report(node.object);
            },
            CallExpression(node) {
                if (node.optional && node.callee.type === "TSNonNullExpression")
                    report(node.callee);
            },
        };
    },
});
