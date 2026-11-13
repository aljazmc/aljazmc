import { rule } from "../../rules.js";

export default rule({
    name: "noEmptyBlock",
    group: "suspicious",
    severity: "warn",
    recommended: true,
    fix: "none",
    languages: ["css"],
    create: (context) => ({
        CssBlock(node) {
            if (node.children.length > 0) return;
            // a comment is content
            if (
                context.comments.some(
                    (comment) =>
                        comment.start > node.start && comment.end < node.end,
                )
            )
                return;
            context.report(node, "An empty block isn't allowed.");
        },
    }),
});
