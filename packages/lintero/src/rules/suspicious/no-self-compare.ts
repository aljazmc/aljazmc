import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noSelfCompare",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        BinaryExpression(node) {
            if (
                ["==", "===", "!=", "!==", "<", ">", "<=", ">="].includes(
                    node.operator,
                ) &&
                Nodes.same(node.left, node.right)
            )
                context.report(
                    node,
                    "This comparison uses the same expression on both sides.",
                );
        },
    }),
});
