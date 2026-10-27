import { type Markdown as Md, parseMarkdown } from "@aljazmc/syntax";

export interface Options {
    lineWidth: number;
    /** One level of indentation, for definitions that break. */
    indent: string;
    proseWrap: "always" | "never" | "preserve";
    /** Formats the code of a fenced block by its info string, undefined keeps it as written. */
    embed?: (code: string, info: string) => string | undefined;
}

/** Where blocks are, they are separated and printed differently in each. */
type Container = "root" | "quote" | "item";

/** A word, or what separates words in a paragraph. */
type Token =
    | { kind: "word"; text: string }
    | { kind: "space" }
    | { kind: "soft"; line: number }
    | { kind: "hard"; raw: string };

/** Where a paragraph of a list item starts its content, and how far each of its lines is indented. */
interface Outdent {
    indent: number;
    leads: number[];
}

/** Starts lines printed as they are in the source, without the indentation of their list items. */
const LITERAL = "\u0000";
/** Blank lines of quotes, written `> ` or `>` in the source. */
const BLANK = "\u0001";
const BLANK_TIGHT = "\u0002";

/** Formats Markdown like Biome: keeps the text, normalizes markers, fences, tables and spacing. */
export default class Markdown {
    readonly #options: Options;
    #source: string[] = [];

    constructor(options: Options) {
        this.#options = options;
    }

    format(source: string): string {
        const root = parseMarkdown(source);
        this.#source = source.split(/\r\n|\r|\n/);
        const lines: string[] = [];
        if (root.frontmatter) {
            lines.push(...root.frontmatter.raw.split(/\r\n|\r|\n/));
            if (root.children.length > 0) lines.push("");
        }
        lines.push(...this.#blocks(root.children, "root", 0));
        const text = lines.join("\n").replaceAll(LITERAL, "");
        return `${root.bom ? "﻿" : ""}${text}${text ? "\n" : ""}`;
    }

    // blocks

    #blocks(
        blocks: Md.Block[],
        container: Container,
        width: number,
        item?: Md.ListItem,
    ): string[] {
        const lines: string[] = [];
        let previous: Md.Block | undefined;
        let sibling = 0;
        for (const block of blocks) {
            if (previous) {
                const blank = block.line - previous.endLine - 1;
                const separation = this.#separation(
                    previous,
                    block,
                    blank,
                    container,
                );
                for (let index = 0; index < separation; index++)
                    lines.push(
                        container === "quote"
                            ? this.#blank(previous.endLine + 1 + index)
                            : "",
                    );
            }
            sibling =
                block.type === "List" &&
                previous?.type === "List" &&
                previous.ordered === block.ordered
                    ? sibling + 1
                    : 0;
            lines.push(...this.#block(block, container, width, sibling, item));
            previous = block;
        }
        return lines;
    }

    /** The blank lines between two blocks, which had `blank` of them. */
    #separation(
        previous: Md.Block,
        next: Md.Block,
        blank: number,
        container: Container,
    ): number {
        if (container === "item") {
            if (Markdown.#fenced(previous)) return 1;
            if (next.type === "ThematicBreak") return 1;
            if (
                Markdown.#fenced(next) &&
                (previous.type === "Paragraph" || previous.type === "List")
            )
                return 1;
            if (next.type === "List")
                return Markdown.#comment(previous) ? blank : 0;
            return Math.min(blank, 1);
        }
        if (container === "quote") {
            if (
                blank === 0 &&
                previous.type === "Paragraph" &&
                Markdown.#fenced(next)
            )
                return 1;
            return blank;
        }
        if (Markdown.#comment(previous)) return blank;
        if (previous.type === "Definition" && next.type === "Definition")
            return 0;
        if (previous.type === "ThematicBreak" || next.type === "ThematicBreak")
            return 1;
        if (previous.type === "Heading") return 1;
        if (previous.type === "List") return next.type === "List" ? 1 : blank;
        if (Markdown.#fenced(previous) && next.type === "List") return 1;
        if (next.type === "List" && blank > 0) {
            // like Biome, blocks ending with their own line break lose one blank line
            if (previous.type === "HtmlBlock") return Math.max(blank, 1);
            if (previous.type === "Table" || previous.type === "BlockQuote")
                return blank - 1;
        }
        return blank;
    }

    static #fenced(block: Md.Block): boolean {
        return block.type === "CodeBlock" && block.fence !== "";
    }

    static #comment(block: Md.Block): boolean {
        return (
            block.type === "HtmlBlock" &&
            block.kind === 2 &&
            block.lines.join("\n").trim().endsWith("-->")
        );
    }

    #block(
        block: Md.Block,
        container: Container,
        width: number,
        sibling: number,
        item?: Md.ListItem,
    ): string[] {
        switch (block.type) {
            case "Paragraph":
                return this.#paragraph(block, container, width, item);
            case "Heading":
                return this.#heading(block, width);
            case "ThematicBreak":
                return ["---"];
            case "CodeBlock":
                return block.fence
                    ? this.#fencedCode(block, container)
                    : this.#indentedCode(block, container);
            case "HtmlBlock":
                return block.lines;
            case "Definition":
                return this.#definition(block, width);
            case "BlockQuote":
                return this.#quote(block, width);
            case "List":
                return this.#list(block, width, sibling);
            case "Table":
                return this.#table(
                    block,
                    block.rows[0]?.cells.length ?? 0,
                    width,
                );
        }
    }

    /** Definitions are one line, `always` breaks long ones after the label. */
    #definition(definition: Md.Definition, width: number): string[] {
        const { indent, label, destination, title } = definition;
        const line = `${indent}${label}: ${destination}${title === null ? "" : ` ${title}`}`;
        if (
            this.#options.proseWrap !== "always" ||
            Markdown.width(line) <= this.#options.lineWidth - width
        )
            return [line];
        const unit = this.#options.indent;
        return [
            `${indent}${label}:`,
            `${unit}${destination}`,
            ...(title === null ? [] : [`${unit}${title}`]),
        ];
    }

    #heading(heading: Md.Heading, width: number): string[] {
        if (heading.setext) {
            const lines = this.#prose(
                heading.children,
                heading.text,
                width,
                false,
            );
            if (lines.length > 1 && this.#options.proseWrap !== "never")
                return [...lines, heading.underline];
            const content = lines.join(" ");
            return [
                `${heading.level === 1 ? "#" : "##"}${content ? ` ${content}` : ""}`,
            ];
        }
        let content = this.#inlines(heading.children, heading.text, []);
        // like Biome, two spaces or more are a line break it removes, one stays
        if (/[ \t]{2,}$/.test(content)) content = content.trimEnd();
        return [`${"#".repeat(heading.level)}${content ? ` ${content}` : ""}`];
    }

    #paragraph(
        paragraph: Md.Paragraph,
        container: Container,
        width: number,
        item?: Md.ListItem,
    ): string[] {
        if (container === "quote" && this.#options.proseWrap === "preserve")
            return this.#inlines(paragraph.children, paragraph.text, [])
                .split("\n")
                .map((line, index) =>
                    index === 0
                        ? line
                        : `${paragraph.indents[index] ?? ""}${line}`,
                );
        return this.#prose(
            paragraph.children,
            paragraph.text,
            width,
            true,
            paragraph.prefixes.map((prefix, index) =>
                /^[ \t]*$/.test(prefix)
                    ? `${LITERAL}${prefix}`
                    : (paragraph.indents[index] ?? ""),
            ),
            item && {
                indent: item.indent + item.marker.length + item.spaces,
                // only lazy lines, others have the indentation of the item
                leads: paragraph.indents.map((indent, index) =>
                    paragraph.lazy[index]
                        ? (/^ */.exec(indent)?.[0].length ?? 0)
                        : Number.POSITIVE_INFINITY,
                ),
            },
        );
    }

    #fencedCode(code: Md.CodeBlock, container: Container): string[] {
        let lines = code.lines;
        if (container === "item") lines = lines.map((line) => line.trimEnd());
        const embedded =
            container === "root" && code.closed && code.info
                ? this.#options.embed?.(lines.join("\n"), code.info)
                : undefined;
        if (embedded !== undefined)
            lines = embedded === "" ? [] : embedded.split("\n");
        let longest = 0;
        for (const run of code.lines.join("\n").match(/`+/g) ?? [])
            longest = Math.max(longest, run.length);
        const fence = "`".repeat(Math.max(3, longest + 1));
        return [`${fence}${code.info}`, ...lines, fence];
    }

    #indentedCode(code: Md.CodeBlock, container: Container): string[] {
        if (container !== "item")
            return code.lines.map((line) => (line === "" ? "" : `    ${line}`));
        // like Biome, only the first line loses the common indentation, the
        // others stay as they are in the source
        const common = Math.min(
            ...code.lines
                .filter((line) => line.trim() !== "")
                .map((line) => /^ */.exec(line)?.[0].length ?? 0),
        );
        return code.lines.map((line, index) =>
            index === 0
                ? `    ${line.slice(common)}`
                : line.trim() === ""
                  ? ""
                  : `${LITERAL}${code.prefixes[index] ?? ""}${line}`,
        );
    }

    #quote(quote: Md.BlockQuote, width: number): string[] {
        const lines = this.#blocks(quote.children, "quote", width + 2);
        const first = quote.children[0];
        const last = quote.children.at(-1);
        // quote-only lines before and after the content stay
        const leading = first ? first.line - quote.line : 0;
        const trailing = last ? quote.endLine - last.endLine : 0;
        return [
            ...Array.from({ length: leading }, (_, index) =>
                this.#blank(quote.line + index),
            ),
            ...lines,
            ...Array.from({ length: trailing }, (_, index) =>
                this.#blank((last?.endLine ?? 0) + 1 + index),
            ),
        ].map((line) =>
            line === "" || line === BLANK_TIGHT
                ? ">"
                : line === BLANK
                  ? "> "
                  : `> ${line}`,
        );
    }

    /** A blank line of a quote, `> ` when its source line ends with a space after `>`. */
    #blank(line: number): string {
        return /> $/.test(this.#source[line - 1] ?? "") ? BLANK : BLANK_TIGHT;
    }

    #list(list: Md.List, width: number, sibling: number): string[] {
        const dash = list.children.some((item) => {
            const first = item.children[0];
            return first?.type === "ThematicBreak" && first.raw.startsWith("-");
        });
        const bullet = sibling % 2 === 1 ? "*" : dash ? "+" : "-";
        const delimiter = sibling % 2 === 1 ? ")" : ".";
        const numbers = list.children
            .slice(0, 3)
            .map((item) => item.number ?? 0);
        const start = numbers[0] ?? 1;
        const repeated =
            numbers.length >= 2 &&
            numbers[1] === 1 &&
            (numbers[0] !== 0 || numbers[2] === 1);

        const lines: string[] = [];
        for (const [index, item] of list.children.entries()) {
            const previous = list.children[index - 1];
            if (
                previous &&
                (item.line > previous.endLine + 1 ||
                    Markdown.#nestedFence(previous))
            )
                lines.push("");
            const marker = list.ordered
                ? `${index === 0 ? start : repeated ? 1 : start + index}${delimiter}`
                : bullet;
            lines.push(...this.#item(item, marker, width));
        }
        return lines;
    }

    /** Whether an item ends with a list that ends with fenced code. */
    static #nestedFence(item: Md.ListItem): boolean {
        let last = item.children.at(-1);
        if (last?.type !== "List") return false;
        while (last?.type === "List")
            last = last.children.at(-1)?.children.at(-1);
        return !!last && Markdown.#fenced(last);
    }

    #item(item: Md.ListItem, marker: string, width: number): string[] {
        const spaces = Math.max(item.spaces, 1);
        const align = marker.length + spaces;
        const lines = this.#blocks(item.children, "item", width + align, item);
        const first = item.children[0];
        if (first?.type === "ThematicBreak" && marker === "-") lines[0] = "***";
        if (item.checked !== null && first?.type === "Paragraph")
            lines[0] = (lines[0] ?? "").replace(/^\[X\]/, "[x]");
        if (lines.length === 0) return [marker];
        return lines.map((line, index) =>
            index === 0
                ? `${marker}${" ".repeat(spaces)}${line}`
                : line === "" || line.startsWith(LITERAL)
                  ? line
                  : `${" ".repeat(align)}${line}`,
        );
    }

    #table(table: Md.Table, columns: number, width: number): string[] {
        const rows = table.rows.map((row) =>
            row.cells.map((cell) => {
                const text = this.#inlines(cell.children, cell.text, []);
                return { text, width: Markdown.width(text) };
            }),
        );
        const widths: number[] = [];
        for (const row of rows)
            for (const [index, cell] of row.entries())
                widths[index] = Math.max(widths[index] ?? 3, cell.width);

        const print = (row: { text: string; width: number }[]) =>
            `|${row
                .map(({ text, width }, index) => {
                    const spaces = (widths[index] ?? 3) - width;
                    const alignment = table.alignments[index];
                    const before =
                        alignment === "right"
                            ? spaces
                            : alignment === "center"
                              ? Math.floor(spaces / 2)
                              : 0;
                    return ` ${" ".repeat(before)}${text}${" ".repeat(spaces - before)} |`;
                })
                .join("")}`;

        const [header = [], ...body] = rows;
        // like Biome, `never` drops the padding of tables wider than the line
        if (
            this.#options.proseWrap === "never" &&
            Markdown.width(print(header)) > this.#options.lineWidth - width
        ) {
            const compact = (row: { text: string }[]) =>
                `|${row.map(({ text }) => ` ${text} |`).join("")}`;
            const delimiter = `|${table.alignments
                .slice(0, columns)
                .map((alignment) => {
                    const left = alignment === "left" || alignment === "center";
                    const right =
                        alignment === "right" || alignment === "center";
                    return ` ${left ? ":" : ""}${"-".repeat(3 - Number(left) - Number(right))}${right ? ":" : ""} |`;
                })
                .join("")}`;
            return [compact(header), delimiter, ...body.map(compact)];
        }
        const delimiter = `|${table.alignments
            .slice(0, columns)
            .map((alignment, index) => {
                const left = alignment === "left" || alignment === "center";
                const right = alignment === "right" || alignment === "center";
                const dashes =
                    (widths[index] ?? 3) - Number(left) - Number(right);
                return ` ${left ? ":" : ""}${"-".repeat(dashes)}${right ? ":" : ""} |`;
            })
            .join("")}`;
        return [print(header), delimiter, ...body.map(print)];
    }

    /** Display columns of text, wide characters take two. */
    static width(text: string): number {
        let width = 0;
        for (const char of text) {
            const code = char.codePointAt(0) as number;
            if (
                /[\p{Mn}\p{Me}\p{Cf}]/u.test(char) ||
                (code >= 0xfe00 && code <= 0xfe0f)
            )
                continue;
            width +=
                /\p{Emoji_Presentation}/u.test(char) ||
                (code >= 0x1100 && code <= 0x115f) ||
                (code >= 0x2e80 && code <= 0x303e) ||
                (code >= 0x3041 && code <= 0x33ff) ||
                (code >= 0x3400 && code <= 0x4dbf) ||
                (code >= 0x4e00 && code <= 0x9fff) ||
                (code >= 0xa000 && code <= 0xa4cf) ||
                (code >= 0xac00 && code <= 0xd7a3) ||
                (code >= 0xf900 && code <= 0xfaff) ||
                (code >= 0xfe30 && code <= 0xfe4f) ||
                (code >= 0xff00 && code <= 0xff60) ||
                (code >= 0xffe0 && code <= 0xffe6) ||
                (code >= 0x20000 && code <= 0x3fffd)
                    ? 2
                    : 1;
        }
        return width;
    }

    // inlines

    /** Prose split into words, printed line by line, or wrapped by `proseWrap`. */
    #prose(
        inlines: Md.Inline[],
        text: string,
        width: number,
        breaks: boolean,
        indents: string[] = [],
        outdent?: Outdent,
    ): string[] {
        const tokens: Token[] = [];
        let word = "";
        const finish = () => {
            if (word) tokens.push({ kind: "word", text: word });
            word = "";
        };
        for (const [index, inline] of inlines.entries()) {
            if (inline.type === "Text") {
                for (const part of inline.raw.split(/([\t\n\f\r ]+)/)) {
                    if (part === "") continue;
                    if (/^[\t\n\f\r ]+$/.test(part)) {
                        finish();
                        tokens.push({ kind: "space" });
                    } else word += part;
                }
            } else if (inline.type === "Break") {
                finish();
                tokens.push(
                    inline.hard && breaks
                        ? { kind: "hard", raw: inline.raw }
                        : {
                              kind: "soft",
                              line:
                                  text.slice(0, inline.end).split("\n").length -
                                  1,
                          },
                );
            } else {
                // lines inside links, code and HTML keep their indentation
                let line = text.slice(0, inline.start).split("\n").length - 1;
                word += this.#inline(inline, text, inlines, index, []).replace(
                    /\n/g,
                    () => `\n${indents[++line] ?? ""}`,
                );
            }
        }
        finish();

        // the words of each line, ended by a hard break or not
        const lines: { words: string[]; hard: string }[] = [];
        let line: string[] = [];
        const wrap = this.#options.proseWrap;
        const end = (hard = "") => {
            lines.push({ words: line, hard });
            line = [];
        };
        for (const [index, token] of tokens.entries()) {
            if (token.kind === "word") line.push(token.text);
            else if (token.kind === "hard")
                end(token.raw.startsWith("\\") ? "\\" : "  ");
            else if (token.kind === "soft" && line.length > 0) {
                const next = tokens
                    .slice(index + 1)
                    .find((next) => next.kind === "word");
                const lead = outdent?.leads[token.line] ?? 0;
                // a list marker less indented than the content of its item
                // would start a list once aligned, like Biome, it is joined
                // to the line before, or kept at the start of its line
                if (
                    outdent &&
                    wrap === "preserve" &&
                    next?.kind === "word" &&
                    /^(?:[-*+]|\d+[.)])$/.test(next.text) &&
                    lead < outdent.indent
                ) {
                    if (lead > 0) continue;
                    end();
                    line.push(LITERAL);
                    continue;
                }
                end();
            }
        }
        if (line.length > 0 || lines.length === 0) end();

        if (wrap === "preserve")
            return lines
                .map(({ words, hard }) => {
                    const line = `${words.join(" ")}${hard}`;
                    return line.startsWith(`${LITERAL} `)
                        ? `${LITERAL}${line.slice(2)}`
                        : line;
                })
                .flatMap((line) => line.split("\n"));

        // never joins the lines between hard breaks, always also wraps them
        const segments: { words: string[]; hard: string }[] = [];
        let words: string[] = [];
        for (const line of lines) {
            words.push(...line.words);
            if (line.hard) {
                segments.push({ words, hard: line.hard });
                words = [];
            }
        }
        if (words.length > 0 || segments.length === 0)
            segments.push({ words, hard: "" });
        const available = this.#options.lineWidth - width;
        return segments.flatMap(({ words, hard }) => {
            const filled: string[] = [];
            let current = "";
            for (const word of words) {
                const [first = "", ...rest] = word.split("\n");
                if (
                    wrap === "always" &&
                    current &&
                    Markdown.width(current) + 1 + Markdown.width(first) >
                        available
                ) {
                    filled.push(current);
                    current = first;
                } else current = current ? `${current} ${first}` : first;
                // like Biome, lines inside links, code and HTML stay
                for (const line of rest) {
                    filled.push(current);
                    current = line;
                }
            }
            filled.push(current + hard);
            return filled;
        });
    }

    /** Inlines as written, with their markers normalized. */
    #inlines(
        inlines: Md.Inline[],
        text: string,
        ancestors: Md.Inline[],
    ): string {
        return inlines
            .map((inline, index) =>
                this.#inline(inline, text, inlines, index, ancestors),
            )
            .join("");
    }

    #inline(
        inline: Md.Inline,
        text: string,
        siblings: Md.Inline[],
        index: number,
        ancestors: Md.Inline[],
    ): string {
        const inner = (children: Md.Inline[]) =>
            this.#inlines(children, text, [...ancestors, inline]);
        switch (inline.type) {
            case "Code":
                return inline.raw.includes("\n") ||
                    ancestors.some(
                        (ancestor) =>
                            ancestor.type === "Link" ||
                            ancestor.type === "Image",
                    )
                    ? inline.raw
                    : Markdown.#code(inline.raw);
            case "Text":
            case "Autolink":
            case "Html":
                return inline.raw;
            case "Break":
                return inline.raw;
            case "Strikethrough":
                return `${inline.delimiter}${inner(inline.children)}${inline.delimiter}`;
            case "Strong": {
                const [only] = inline.children;
                const content =
                    inline.children.length === 1 &&
                    only?.type === "Text" &&
                    only.raw === "*"
                        ? "\\*"
                        : inner(inline.children);
                return `**${content}**`;
            }
            case "Emphasis":
                return this.#emphasis(inline, text, siblings, index, ancestors);
            case "Link":
            case "Image": {
                const content = inner(inline.children);
                const open = inline.type === "Image" ? "![" : "[";
                if (inline.reference) return `${open}${content}]${inline.tail}`;
                const title =
                    inline.title === null
                        ? ""
                        : ` ${Markdown.#title(inline.title)}`;
                return `${open}${content}](${inline.destination}${title})`;
            }
        }
    }

    /** Italics use `_`, unless `*` touches a word, is nested or `_` is in the text. */
    #emphasis(
        emphasis: Md.Emphasis,
        text: string,
        siblings: Md.Inline[],
        index: number,
        ancestors: Md.Inline[],
    ): string {
        const inner = (children: Md.Inline[]) =>
            this.#inlines(children, text, [...ancestors, emphasis]);
        const original = emphasis.delimiter;
        const parent = ancestors.at(-1);
        if (
            ancestors.some(
                (ancestor) => ancestor.type === "Image" && ancestor.reference,
            ) ||
            (parent?.type === "Link" && parent.reference)
        )
            return `${original}${inner(emphasis.children)}${original}`;

        const word = (char: string | undefined) =>
            char !== undefined && !/[\s\p{P}\p{S}]/u.test(char);
        const touches =
            original === "*" &&
            (word(text[emphasis.start - 1]) || word(text[emphasis.end]));
        const resolved = original === "_" || !touches ? "_" : "*";

        const [only] = emphasis.children;
        const before = siblings.slice(0, index).some(Markdown.#visible);
        const after = siblings.slice(index + 1).some(Markdown.#visible);
        if (
            original === "*" &&
            resolved === "_" &&
            before &&
            after &&
            emphasis.children.length === 1 &&
            only?.type === "Strong" &&
            only.delimiter === "**"
        )
            return `**_${this.#inlines(only.children, text, [...ancestors, emphasis, only])}_**`;

        let target = ancestors.some((ancestor) => ancestor.type === "Emphasis")
            ? "*"
            : resolved;
        if (
            emphasis.children.some(
                (child) => child.type === "Text" && child.raw.includes(target),
            )
        )
            target = original;
        return `${target}${inner(emphasis.children)}${target}`;
    }

    /**
     * Code spans use the shortest fence their content allows, without the
     * spaces that CommonMark strips, and with spaces where it needs them.
     */
    static #code(raw: string): string {
        const length = (/^`+/.exec(raw)?.[0] ?? "`").length;
        let content = raw.slice(length, -length);
        const nonSpace = /[^ \r\n]/.test(content);
        if (
            nonSpace &&
            /^(?:\r\n|[ \r\n])/.test(content) &&
            /(?:\r\n|[ \r\n])$/.test(content)
        )
            content = content
                .replace(/^(?:\r\n|[ \r\n])/, "")
                .replace(/(?:\r\n|[ \r\n])$/, "");
        if (content === "") return raw;
        const runs = new Set(
            (content.match(/`+/g) ?? []).map((run) => run.length),
        );
        let fence = 1;
        while (runs.has(fence)) fence++;
        const padding =
            content.startsWith("`") ||
            content.endsWith("`") ||
            (nonSpace && content.startsWith(" ") && content.endsWith(" "))
                ? " "
                : "";
        const ticks = "`".repeat(fence);
        return `${ticks}${padding}${content}${padding}${ticks}`;
    }

    static #visible(inline: Md.Inline): boolean {
        if (inline.type === "Break") return false;
        return inline.type !== "Text" || /\S/.test(inline.raw);
    }

    /** Titles use the quotes that need the fewest escapes, double ones on ties. */
    static #title(title: string): string {
        const content = title.slice(1, -1);
        if (
            title.startsWith('"') ||
            content.includes('"') ||
            content.includes("\\")
        )
            return title;
        return `"${content}"`;
    }
}
