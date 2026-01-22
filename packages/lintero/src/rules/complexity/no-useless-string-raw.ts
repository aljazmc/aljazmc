import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noUselessStringRaw",
    group: "complexity",
    severity: "info",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        TaggedTemplateExpression(node) {
            const tag = Nodes.unwrap(node.tag);
            if (Nodes.path(tag) !== "String.raw") return;
            if (
                tag.type === "MemberExpression" &&
                !context.semantic.isGlobal(tag.object)
            )
                return;
            if (node.quasi.quasis.some((quasi) => quasi.raw.includes("\\")))
                return;
            context.report(
                node,
                "String.raw is useless when the raw string doesn't contain any escape sequence.",
            );
        },
    }),
});
