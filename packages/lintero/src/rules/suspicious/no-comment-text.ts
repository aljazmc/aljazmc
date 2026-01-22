import { rule } from "../../rules.js";

export default rule({
    name: "noCommentText",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["jsx"],
    create: (context) => ({
        JSXText(node) {
            const comments = /(?<=^|\s)(?:\/\/[^\r\n]*|\/\*[\s\S]*?\*\/)/g;
            for (const match of node.raw.matchAll(comments)) {
                const start = node.start + match.index;
                context.report(
                    { start, end: start + match[0].length },
                    "Wrap comments inside children within braces.",
                );
            }
        },
    }),
});
