import type { Node } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

const negativeZero = (node: Node) =>
    node.type === "UnaryExpression" &&
    node.operator === "-" &&
    node.argument.type === "NumericLiteral" &&
    Number(node.argument.raw.replace(/_/g, "")) === 0;

export default rule({
    name: "noCompareNegZero",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "safe",
    languages: ["js"],
    create: (context) => ({
        BinaryExpression(node) {
            if (
                !["==", "===", "!=", "!==", "<", ">", "<=", ">="].includes(
                    node.operator,
                )
            )
                return;
            const zero = [node.left, node.right].find(negativeZero);
            if (zero?.type !== "UnaryExpression") return;
            context.report(
                node,
                `Do not use the ${node.operator} operator to compare against -0.`,
                {
                    message: "Replace -0 with 0",
                    edits: [
                        {
                            start: zero.start,
                            end: zero.end,
                            text: context.slice(zero.argument),
                        },
                    ],
                },
            );
        },
    }),
});
