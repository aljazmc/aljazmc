import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noDocumentCookie",
    group: "suspicious",
    severity: "warn",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        AssignmentExpression(node) {
            const left = Nodes.unwrap(node.left);
            if (
                left.type !== "MemberExpression" ||
                Nodes.path(left) !== "document.cookie" ||
                !context.semantic.isGlobal(left.object)
            )
                return;
            context.report(
                node,
                "Direct assigning to document.cookie is not recommended.",
            );
        },
    }),
});
