import type { Node } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

const irregular =
    /[\v\f\u0085\u00A0\u1680\u180E\u2000-\u200B\u2028\u2029\u202F\u205F\u3000\uFEFF]/g;

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
    languages: ["js"],
    create: (context) => {
        const skipped: { start: number; end: number }[] = [...context.comments];
        return {
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
