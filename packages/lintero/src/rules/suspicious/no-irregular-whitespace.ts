import type { Node } from "@aljazmc/syntax";
import { strings } from "../../analysis/css.js";
import { rule } from "../../rules.js";

const irregular =
    /[\v\f\u0085\u00A0\u1680\u180E\u2000-\u200B\u2028\u2029\u202F\u205F\u3000\uFEFF]/g;

const cssIrregular =
    /[\v\f\u0085\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]+/g;

/** Nodes whose text may hold any character. */
const texts = new Set([
    "StringLiteral",
    "TemplateElement",
    "RegExpLiteral",
    "JSXText",
]);

export default rule({
    name: "noIrregularWhitespace",
    group: "suspicious",
    severity: "warn",
    recommended: true,
    fix: "none",
    languages: ["css", "js"],
    create: (context) => {
        const skipped: { start: number; end: number }[] = [...context.comments];
        return {
            CssStylesheet(sheet) {
                // like Biome, CSS has no irregular line separators, strings and comments may hold any
                const text = context.text;
                const ranges = [
                    ...sheet.comments,
                    ...strings(text, sheet.comments),
                ];
                const name = (char: string | undefined) =>
                    char !== undefined && /[\w\-\u0080-\uffff]/.test(char);
                let reported = -1;
                for (const match of text.matchAll(cssIrregular)) {
                    let start = match.index;
                    let end = start + match[0].length;
                    // a byte order mark may start the file
                    if (start === 0 && match[0].startsWith("\uFEFF")) start = 1;
                    if (start >= end) continue;
                    if (
                        ranges.some(
                            (range) =>
                                range.start <= start && start < range.end,
                        )
                    )
                        continue;
                    // a byte order mark is part of the identifier it follows, Biome reports the identifier
                    if (text[start] === "\uFEFF" && name(text[start - 1])) {
                        while (start > 0 && name(text[start - 1])) start--;
                        while (name(text[end])) end++;
                    }
                    if (start <= reported) continue;
                    reported = start;
                    context.report(
                        { start, end },
                        "Irregular whitespace found.",
                    );
                }
            },
            "*"(node: Node) {
                if (texts.has(node.type)) skipped.push(node);
            },
            "Program:exit"() {
                for (const match of context.text.matchAll(irregular)) {
                    const start = match.index;
                    // a byte order mark may start the file
                    if (start === 0 && match[0] === "\uFEFF") continue;
                    if (
                        skipped.some(
                            (range) =>
                                range.start <= start && start < range.end,
                        )
                    )
                        continue;
                    context.report(
                        { start, end: start + match[0].length },
                        "Irregular whitespaces found.",
                    );
                }
            },
        };
    },
});
