import type { Node } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

/** +1 when an update increases the counter, -1 when it decreases it, 0 when unknown. */
const direction = (update: Node, counter: string): number => {
    if (
        update.type === "UpdateExpression" &&
        update.argument.type === "Identifier" &&
        update.argument.name === counter
    )
        return update.operator === "++" ? 1 : -1;
    if (
        update.type === "AssignmentExpression" &&
        update.left.type === "Identifier" &&
        update.left.name === counter
    ) {
        const sign =
            update.operator === "+=" ? 1 : update.operator === "-=" ? -1 : 0;
        let value = update.right;
        let factor = 1;
        if (value.type === "UnaryExpression" && value.operator === "-") {
            factor = -1;
            value = value.argument;
        }
        if (value.type !== "NumericLiteral") return 0;
        return sign * factor * Math.sign(Nodes.number(value.raw));
    }
    return 0;
};

export default rule({
    name: "useValidForDirection",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        ForStatement(node) {
            const { test, update } = node;
            if (!test || !update || test.type !== "BinaryExpression") return;
            const increasing = ["<", "<="].includes(test.operator);
            if (!increasing && ![">", ">="].includes(test.operator)) return;

            let wrong = false;
            if (test.left.type === "Identifier") {
                const moves = direction(update, test.left.name);
                wrong = moves !== 0 && (increasing ? moves < 0 : moves > 0);
            } else if (test.right.type === "Identifier") {
                const moves = direction(update, test.right.name);
                wrong = moves !== 0 && (increasing ? moves > 0 : moves < 0);
            }
            if (wrong)
                context.report(
                    {
                        start: context.find("(", node.start).start,
                        end: node.body.start,
                    },
                    "The update clause in this loop moves the variable in the wrong direction.",
                );
        },
    }),
});
