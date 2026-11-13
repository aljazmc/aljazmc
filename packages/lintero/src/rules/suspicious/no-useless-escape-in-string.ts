import type { Node } from "@aljazmc/syntax";
import { strings } from "../../analysis/css.js";
import { rule } from "../../rules.js";

/** Characters an escape changes in CSS, besides the quote of the string. */
const css = /[\^\r\n0-9a-fA-F\\nrtuvx\u2028\u2029]/;

/** Characters an escape changes, besides the quote of the string. */
const meaningful = /[\\bfnrtvxu0-9\r\n\u2028\u2029]/;

export default rule({
    name: "noUselessEscapeInString",
    group: "suspicious",
    severity: "warn",
    recommended: true,
    fix: "safe",
    languages: ["css", "js"],
    create: (context) => {
        /** The first useless escape of a text, one is reported per literal. */
        const useless = (
            raw: string,
            offset: number,
            quote: string,
        ): number | undefined => {
            for (let index = 0; index < raw.length; index++) {
                if (raw[index] !== "\\") continue;
                const char = raw[++index] ?? "";
                if (meaningful.test(char) || char === quote) continue;
                // in templates `\${` and `$\{` keep a placeholder from starting
                if (quote === "`" && char === "$" && raw[index + 1] === "{")
                    continue;
                if (quote === "`" && char === "{" && raw[index - 2] === "$")
                    continue;
                return offset + index;
            }
        };
        const report = (start: number | undefined) => {
            if (start === undefined) return;
            context.report(
                { start, end: start + 1 },
                "The character doesn't need to be escaped.",
                {
                    message: "Unescape the character.",
                    edits: [{ start: start - 1, end: start, text: "" }],
                },
            );
        };
        return {
            CssStylesheet(sheet) {
                for (const { start, raw } of strings(
                    context.text,
                    sheet.comments,
                )) {
                    const quote = raw[0] ?? "";
                    for (let index = 1; index < raw.length; index++) {
                        if (raw[index] !== "\\") continue;
                        const char = raw[++index] ?? "";
                        if (char === "" || css.test(char) || char === quote)
                            continue;
                        report(start + index);
                        break;
                    }
                }
            },
            StringLiteral(node) {
                if (context.parent(node)?.type === "JSXAttribute") return;
                const quote = node.raw[0] ?? "";
                report(useless(node.raw.slice(1, -1), node.start + 1, quote));
            },
            TemplateLiteral(node) {
                if (context.parent(node)?.type === "TaggedTemplateExpression")
                    return;
                for (const quasi of node.quasis as Node[]) {
                    if (quasi.type !== "TemplateElement") continue;
                    const start = useless(
                        quasi.raw,
                        context.text.indexOf(quasi.raw, quasi.start),
                        "`",
                    );
                    if (start !== undefined) return report(start);
                }
            },
        };
    },
});
