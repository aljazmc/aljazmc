import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noMisrefactoredShorthandAssign",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    create: (context) => ({
        AssignmentExpression(node) {
            const operator = node.operator.slice(0, -1);
            const right = Nodes.unwrap(node.right);
            if (
                node.operator === "=" ||
                right.type !== "BinaryExpression" ||
                right.operator !== operator ||
                !Nodes.same(Nodes.unwrap(right.left), Nodes.unwrap(node.left))
            )
                return;
            const symbol = context.find(node.operator, node.left.end);
            context.report(
                node,
                "Variable appears on both sides of an assignment operation.",
                {
                    message: "Use = instead.",
                    edits: [{ ...symbol, text: "=" }],
                },
            );
        },
    }),
});
