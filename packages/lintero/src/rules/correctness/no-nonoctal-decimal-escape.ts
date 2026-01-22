import { rule } from "../../rules.js";

export default rule({
    name: "noNonoctalDecimalEscape",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "safe",
    languages: ["js"],
    create: (context) => ({
        StringLiteral(node) {
            for (const match of node.raw.matchAll(/\\(?:[89]|[\s\S])/g)) {
                if (match[0] !== "\\8" && match[0] !== "\\9") continue;
                const start = node.start + match.index;
                context.report(
                    { start, end: start + 2 },
                    "Don't use `\\8` and `\\9` escape sequences in string literals.",
                    {
                        message: "Replace the escape with the digit itself.",
                        edits: [
                            {
                                start,
                                end: start + 2,
                                text: match[0][1] as string,
                            },
                        ],
                    },
                );
            }
        },
    }),
});
