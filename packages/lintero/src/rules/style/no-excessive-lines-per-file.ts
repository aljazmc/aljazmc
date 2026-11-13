import { type Html, type Node, Walker } from "@aljazmc/syntax";
import { strings } from "../../analysis/css.js";
import { rule } from "../../rules.js";

/** The ranges of an HTML file that are tokens with their own text, not trivia. */
function tokens(root: Html.Root): [number, number][] {
    const ranges: [number, number][] = [];
    const attributes = (list: Html.Attribute[]) => {
        for (const { value } of list)
            if (value) ranges.push([value.start, value.end]);
    };
    const visit = (children: Html.Child[]) => {
        for (const child of children) {
            if (child.type !== "Element") {
                ranges.push([child.start, child.end]);
                continue;
            }
            attributes(child.attributes);
            visit(child.children);
        }
    };
    if (root.instruction) attributes(root.instruction.attributes);
    visit(root.children);
    for (const comment of root.comments)
        ranges.push([comment.start, comment.end]);
    return ranges.sort((a, b) => a[0] - b[0]);
}

/**
 * The ranges of a JavaScript file whose line breaks do not count, like
 * Biome's tokens: template text, strings and JSX text.
 */
function multiline(program: Node): [number, number][] {
    const ranges: [number, number][] = [];
    const visit = (node: Node) => {
        if (
            node.type === "TemplateElement" ||
            node.type === "StringLiteral" ||
            node.type === "JSXText"
        )
            ranges.push([node.start, node.end]);
        for (const child of Walker.children(node)) visit(child);
    };
    visit(program);
    return ranges;
}

export default rule<{ maxLines?: number; skipBlankLines?: boolean }>({
    name: "noExcessiveLinesPerFile",
    group: "style",
    severity: "info",
    recommended: false,
    fix: "none",
    languages: ["css", "html", "js"],
    options: { maxLines: 300, skipBlankLines: false },
    create: (context) => {
        const check = (ranges: [number, number][], comments: Set<number>) => {
            const text = context.text;
            const skip = context.options.skipBlankLines ?? false;
            // the line breaks in the trivia before each token count, those before the end of the file not
            let lines = 1;
            let breaks = 0;
            let first: number | undefined;
            let next = 0;
            for (let index = 0; index < text.length; ) {
                while (
                    next < ranges.length &&
                    (ranges[next] as [number, number])[1] <= index
                )
                    next++;
                const range = ranges[next];
                if (range && range[0] <= index && comments.has(range[0])) {
                    index = range[1];
                    continue;
                }
                const char = text[index] as string;
                if ((!range || range[0] > index) && /\s/.test(char)) {
                    if (
                        char === "\n" ||
                        (char === "\r" && text[index + 1] !== "\n")
                    )
                        breaks++;
                    index++;
                    continue;
                }
                first ??= index;
                lines += skip ? Math.min(breaks, 1) : breaks;
                breaks = 0;
                index = range && range[0] <= index ? range[1] : index + 1;
            }
            const max = context.options.maxLines ?? 300;
            if (lines <= max) return;
            context.report(
                { start: first ?? 0, end: text.length },
                `This file has too many lines (${lines}). Maximum allowed is ${max}.`,
            );
        };
        return {
            Program(program) {
                // like Biome, scripts in HTML count on their own too
                const ranges: [number, number][] = [
                    ...context.comments.map(
                        ({ start, end }): [number, number] => [start, end],
                    ),
                    ...multiline(program),
                ].sort((a, b) => a[0] - b[0]);
                check(
                    ranges,
                    new Set(context.comments.map(({ start }) => start)),
                );
            },
            HtmlRoot(root) {
                check(
                    tokens(root),
                    new Set(root.comments.map(({ start }) => start)),
                );
            },
            CssStylesheet(sheet) {
                // strings are tokens, their line breaks do not count
                const ranges: [number, number][] = [
                    ...sheet.comments.map(
                        ({ start, end }): [number, number] => [start, end],
                    ),
                    ...strings(context.text, sheet.comments).map(
                        ({ start, end }): [number, number] => [start, end],
                    ),
                ].sort((a, b) => a[0] - b[0]);
                check(
                    ranges,
                    new Set(sheet.comments.map(({ start }) => start)),
                );
            },
        };
    },
});
