import type { Node } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

/** Whether a value is obviously not a number, like a string, a bigint or a date. */
const nonNumeric = (node: Node): boolean =>
    node.type === "StringLiteral" ||
    node.type === "NullLiteral" ||
    node.type === "BooleanLiteral" ||
    (node.type === "NumericLiteral" && node.raw.endsWith("n")) ||
    (node.type === "NewExpression" && Nodes.path(node.callee) === "Date");

export default rule({
    name: "useMathMinMax",
    group: "complexity",
    severity: "warn",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    create: (context) => ({
        ConditionalExpression(node) {
            const { test, consequent, alternate } = node;
            if (
                test.type !== "BinaryExpression" ||
                !["<", "<=", ">", ">="].includes(test.operator)
            )
                return;
            const { left, right } = test;
            if ([left, right].some(nonNumeric)) return;
            let picksLeft: boolean;
            if (Nodes.same(consequent, left) && Nodes.same(alternate, right))
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
    }),
});
