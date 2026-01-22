import { rule } from "../../rules.js";

export default rule({
    name: "noControlCharactersInRegex",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        RegExpLiteral(node) {
            const end = node.raw.lastIndexOf("/");
            const body = node.raw.slice(1, end);
            const unicode = /[uv]/.test(node.raw.slice(end + 1));
            const control =
                // biome-ignore lint/suspicious/noControlCharactersInRegex: finds raw control characters
                /\\x([0-9a-fA-F]{2})|\\u([0-9a-fA-F]{4})|\\u\{([0-9a-fA-F]+)\}|\\[\s\S]|([\x00-\x1F])/g;

            for (const match of body.matchAll(control)) {
                const [text, hex, unicodeHex, codePoint, raw] = match;
                const value =
                    hex ?? unicodeHex ?? (unicode ? codePoint : undefined);
                if (
                    (value !== undefined &&
                        Number.parseInt(value, 16) <= 0x1f) ||
                    raw !== undefined
                ) {
                    const start = node.start + 1 + match.index;
                    context.report(
                        { start, end: start + text.length },
                        "Unexpected control character in a regular expression.",
                    );
                }
            }
        },
    }),
});
