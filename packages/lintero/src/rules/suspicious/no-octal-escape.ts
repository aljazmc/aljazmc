import { rule } from "../../rules.js";

export default rule({
    name: "noOctalEscape",
    group: "suspicious",
    severity: "warn",
    recommended: true,
    fix: "safe",
    languages: ["js"],
    create: (context) => ({
        StringLiteral(node) {
            const escapes = /\\(?:([0-3][0-7]{0,2}|[4-7][0-7]?)|[\s\S])/g;
            for (const match of node.raw.matchAll(escapes)) {
                const [text, digits] = match;
                // `\0` alone is the null character, not an octal escape
                if (
                    !digits ||
                    (digits === "0" &&
                        !/[0-7]/.test(node.raw[match.index + 2] ?? ""))
                )
                    continue;
                const start = node.start + match.index;
                const hex = Number.parseInt(digits, 8)
                    .toString(16)
                    .toUpperCase()
                    .padStart(2, "0");
                context.report(
                    { start, end: start + text.length },
                    "Don't use deprecated octal escape sequences.",
                    {
                        message: "Use a hexadecimal escape sequence instead.",
                        edits: [
                            {
                                start,
                                end: start + text.length,
                                text: `\\x${hex}`,
                            },
                        ],
                    },
                );
            }
        },
    }),
});
