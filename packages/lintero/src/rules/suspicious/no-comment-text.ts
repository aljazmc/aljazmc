import { rule } from "../../rules.js";

export default rule({
    name: "noCommentText",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "unsafe",
    languages: ["jsx"],
    create: (context) => ({
        JSXText(node) {
            const comments = /(?<=^|\s)(?:\/\/[^\r\n]*|\/\*[\s\S]*?\*\/)/g;
            for (const match of node.raw.matchAll(comments)) {
                const start = node.start + match.index;
                const comment = match[0];
                const block = comment.startsWith("//")
                    ? `/*${comment.slice(2).trimEnd()} */`
                    : comment;
                context.report(
                    { start, end: start + comment.length },
                    "Wrap comments inside children within braces.",
                    {
                        message: "Wrap the comments with braces",
                        edits: [
                            {
                                start,
                                end: start + comment.length,
                                text: `{${block}}`,
                            },
                        ],
                    },
                );
            }
        },
    }),
});
