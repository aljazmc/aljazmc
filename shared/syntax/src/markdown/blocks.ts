import type {
    Alignment,
    Block,
    BlockQuote,
    CodeBlock,
    Definition,
    Frontmatter,
    Heading,
    HtmlBlock,
    List,
    ListItem,
    Paragraph,
    Root,
    Table,
    TableRow,
    ThematicBreak,
} from "./ast.js";
import Inlines from "./inlines.js";
import Scan, { CLOSE_TAG, OPEN_TAG } from "./scan.js";

export interface MarkdownOptions {
    /** GitHub Flavored Markdown: tables, task list items and strikethrough. */
    gfm?: boolean;
    /** A `---` fenced block of YAML at the very start of the file. */
    frontmatter?: boolean;
}

type Kind =
    | "Root"
    | "BlockQuote"
    | "List"
    | "ListItem"
    | "Paragraph"
    | "Heading"
    | "ThematicBreak"
    | "CodeBlock"
    | "HtmlBlock"
    | "Table";

/** A block while it is parsed, finished into its node when closed. */
interface Open {
    kind: Kind;
    parent: Open | null;
    children: Open[];
    open: boolean;
    start: number;
    line: number;
    endLine: number;
    /** Content lines of leaves, and the source offsets they start at. */
    lines: string[];
    offsets: number[];
    /** List items: columns before the marker and to the content. */
    markerOffset: number;
    padding: number;
    marker: string;
    /** List items: the spaces after the marker as written. */
    spaces: number;
    delimiter: string;
    ordered: boolean;
    number: number | null;
    /** Code blocks: the fence, its indentation, info string and whether it closed. */
    fence: string;
    fenceOffset: number;
    info: string;
    closed: boolean;
    htmlKind: number;
    level: number;
    setext: boolean;
    alignments: Alignment[];
    /** Definitions taken from the start of a paragraph. */
    definitions: Definition[];
    /** The indentation of each line after the containers, which leaves start from. */
    indents: string[];
    /** The source of each line before its content. */
    prefixes: string[];
    /** Paragraphs: the numbers of lines continued lazily. */
    lazy: Set<number>;
}

const htmlOpen = [
    /./,
    /^<(?:script|pre|textarea|style)(?:\s|>|$)/i,
    /^<!--/,
    /^<[?]/,
    /^<![A-Za-z]/,
    /^<!\[CDATA\[/,
    /^<[/]?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[123456]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|[/]?[>]|$)/i,
    new RegExp(`^(?:${OPEN_TAG}|${CLOSE_TAG})\\s*$`, "i"),
];
const htmlClose = [
    /./,
    /<\/(?:script|pre|textarea|style)>/i,
    /-->/,
    /\?>/,
    />/,
    /\]\]>/,
];

const thematicBreak = /^(?:\*[ \t]*){3,}$|^(?:_[ \t]*){3,}$|^(?:-[ \t]*){3,}$/;
const delimiterRow =
    /^\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;

/** Parses Markdown blocks line by line, like CommonMark's reference parser. */
export default class Blocks {
    readonly #source: string;
    readonly #gfm: boolean;
    readonly #lines: { text: string; start: number }[] = [];
    readonly #root: Open;
    #tip: Open;
    #oldTip: Open;
    #lastMatched: Open;
    #allClosed = true;
    #lineNumber = 0;
    #line = "";
    #lineStart = 0;
    #offset = 0;
    #column = 0;
    #nextNonspace = 0;
    #nextNonspaceColumn = 0;
    #indent = 0;
    #indented = false;
    #blank = false;
    #partialTab = false;
    /** Whether a block took the whole line when it started, like a fence or a delimiter row. */
    #consumed = false;
    /** Where the content of the line starts, after the prefixes of the containers. */
    #contentStart = 0;

    constructor(source: string, options: MarkdownOptions = {}) {
        this.#source = source;
        this.#gfm = options.gfm ?? true;
        this.#root = this.#create("Root", null, 0, 1);
        this.#tip = this.#root;
        this.#oldTip = this.#root;
        this.#lastMatched = this.#root;

        const pattern = /\r\n|\r|\n/g;
        let start = 0;
        for (const match of source.matchAll(pattern)) {
            this.#lines.push({
                text: source.slice(start, match.index),
                start,
            });
            start = match.index + match[0].length;
        }
        if (start < source.length)
            this.#lines.push({ text: source.slice(start), start });
    }

    parse(frontmatter = false): Root {
        const bom = this.#source.startsWith("\uFEFF");
        let first = 0;
        let matter: Frontmatter | null = null;
        if (bom && this.#lines[0])
            this.#lines[0] = {
                text: this.#lines[0].text.slice(1),
                start: 1,
            };
        if (frontmatter && /^---[ \t]*$/.test(this.#lines[0]?.text ?? "")) {
            const close = this.#lines.findIndex(
                (line, index) => index > 0 && /^---[ \t]*$/.test(line.text),
            );
            if (close > 0) {
                const end = this.#lines[close] as {
                    text: string;
                    start: number;
                };
                matter = {
                    type: "Frontmatter",
                    start: this.#lines[0]?.start ?? 0,
                    end: end.start + end.text.length,
                    line: 1,
                    endLine: close + 1,
                    raw: this.#source.slice(
                        this.#lines[0]?.start ?? 0,
                        end.start + end.text.length,
                    ),
                };
                first = close + 1;
                this.#lineNumber = first;
            }
        }

        for (const { text, start } of this.#lines.slice(first)) {
            this.#lineStart = start;
            this.#incorporate(text);
        }
        while (this.#tip !== this.#root) this.#close(this.#tip);
        this.#close(this.#root);

        const definitions = new Map<string, Definition>();
        const children = this.#blocks(this.#root, definitions);
        const inlines = new Inlines(new Set(definitions.keys()), this.#gfm);
        Blocks.#inlines(children, inlines);

        return {
            type: "Root",
            start: 0,
            end: this.#source.length,
            line: 1,
            endLine: Math.max(this.#lines.length, 1),
            bom,
            frontmatter: matter,
            children,
        };
    }

    #create(
        kind: Kind,
        parent: Open | null,
        start: number,
        line: number,
    ): Open {
        return {
            kind,
            parent,
            children: [],
            open: true,
            start,
            line,
            endLine: line,
            lines: [],
            offsets: [],
            markerOffset: 0,
            padding: 0,
            marker: "",
            spaces: 0,
            delimiter: "",
            ordered: false,
            number: null,
            fence: "",
            fenceOffset: 0,
            info: "",
            closed: false,
            htmlKind: 0,
            level: 0,
            setext: false,
            alignments: [],
            definitions: [],
            indents: [],
            prefixes: [],
            lazy: new Set(),
        };
    }

    // line state, like commonmark.js

    #findNextNonspace(): void {
        const line = this.#line;
        let index = this.#offset;
        let column = this.#column;
        let char = line[index];
        while (char === " " || char === "\t") {
            column += char === " " ? 1 : 4 - (column % 4);
            char = line[++index];
        }
        this.#blank = index >= line.length;
        this.#nextNonspace = index;
        this.#nextNonspaceColumn = column;
        this.#indent = column - this.#column;
        this.#indented = this.#indent >= 4;
    }

    #advanceNextNonspace(): void {
        this.#offset = this.#nextNonspace;
        this.#column = this.#nextNonspaceColumn;
        this.#partialTab = false;
    }

    #advance(count: number, columns = false): void {
        const line = this.#line;
        let remaining = count;
        let char = line[this.#offset];
        while (remaining > 0 && char !== undefined) {
            if (char === "\t") {
                const toTab = 4 - (this.#column % 4);
                if (columns) {
                    this.#partialTab = toTab > remaining;
                    const advance = Math.min(toTab, remaining);
                    this.#column += advance;
                    this.#offset += this.#partialTab ? 0 : 1;
                    remaining -= advance;
                } else {
                    this.#partialTab = false;
                    this.#column += toTab;
                    this.#offset += 1;
                    remaining -= 1;
                }
            } else {
                this.#partialTab = false;
                this.#offset += 1;
                this.#column += 1;
                remaining -= 1;
            }
            char = line[this.#offset];
        }
    }

    #rest(): string {
        return this.#line.slice(this.#nextNonspace);
    }

    #addLine(): void {
        this.#tip.prefixes.push(this.#line.slice(0, this.#offset));
        let text = this.#line.slice(this.#offset);
        if (this.#partialTab) {
            this.#offset += 1;
            const spaces = 4 - (this.#column % 4);
            text = " ".repeat(spaces) + this.#line.slice(this.#offset);
        }
        this.#tip.indents.push(
            this.#line.slice(
                this.#contentStart,
                Math.max(this.#offset, this.#contentStart),
            ),
        );
        this.#tip.lines.push(text);
        this.#tip.offsets.push(this.#lineStart + this.#offset);
        this.#tip.endLine = this.#lineNumber;
    }

    #add(kind: Kind, offset: number): Open {
        while (!Blocks.#canContain(this.#tip.kind, kind))
            this.#close(this.#tip);
        const block = this.#create(
            kind,
            this.#tip,
            this.#lineStart + offset,
            this.#lineNumber,
        );
        this.#tip.children.push(block);
        this.#tip = block;
        return block;
    }

    static #canContain(parent: Kind, child: Kind): boolean {
        if (parent === "List") return child === "ListItem";
        return (
            (parent === "Root" ||
                parent === "BlockQuote" ||
                parent === "ListItem") &&
            child !== "ListItem"
        );
    }

    #closeUnmatched(): void {
        if (this.#allClosed) return;
        while (this.#oldTip !== this.#lastMatched) {
            const parent = this.#oldTip.parent as Open;
            this.#close(this.#oldTip);
            this.#oldTip = parent;
        }
        this.#allClosed = true;
    }

    #close(block: Open): void {
        const parent = block.parent;
        block.open = false;
        if (block.kind === "Paragraph") this.#takeDefinitions(block);
        if (block.kind === "CodeBlock" && !block.fence) {
            while (
                block.lines.length > 0 &&
                /^[ \t]*$/.test(block.lines.at(-1) ?? "")
            ) {
                block.lines.pop();
                block.offsets.pop();
                block.prefixes.pop();
            }
            block.endLine = block.line + Math.max(block.lines.length - 1, 0);
        }
        if (block.children.length > 0)
            block.endLine = Math.max(
                block.endLine,
                ...block.children.map((child) => child.endLine),
            );
        if (parent) this.#tip = parent;
    }

    /** Continues an open block on the current line: 0 matched, 1 not, 2 the line is consumed. */
    #continue(block: Open): number {
        const line = this.#line;
        switch (block.kind) {
            case "BlockQuote":
                if (!this.#indented && line[this.#nextNonspace] === ">") {
                    this.#advanceNextNonspace();
                    this.#advance(1);
                    if (
                        line[this.#offset] === " " ||
                        line[this.#offset] === "\t"
                    )
                        this.#advance(1, true);
                    block.endLine = this.#lineNumber;
                    return 0;
                }
                return 1;
            case "ListItem":
                if (this.#blank) {
                    if (block.children.length === 0) return 1;
                    this.#advanceNextNonspace();
                    return 0;
                }
                if (this.#indent >= block.markerOffset + block.padding) {
                    this.#advance(block.markerOffset + block.padding, true);
                    return 0;
                }
                return 1;
            case "CodeBlock": {
                if (block.fence) {
                    const match =
                        this.#indent <= 3 &&
                        line[this.#nextNonspace] === block.fence[0]
                            ? /^(?:`{3,}|~{3,})(?=[ \t]*$)/.exec(this.#rest())
                            : null;
                    if (match && match[0].length >= block.fence.length) {
                        block.closed = true;
                        block.endLine = this.#lineNumber;
                        this.#close(block);
                        return 2;
                    }
                    let skip = block.fenceOffset;
                    while (
                        skip > 0 &&
                        (line[this.#offset] === " " ||
                            line[this.#offset] === "\t")
                    ) {
                        this.#advance(1, true);
                        skip--;
                    }
                    return 0;
                }
                if (this.#indent >= 4) {
                    this.#advance(4, true);
                    return 0;
                }
                if (this.#blank) {
                    this.#advanceNextNonspace();
                    return 0;
                }
                return 1;
            }
            case "HtmlBlock":
                return this.#blank &&
                    (block.htmlKind === 6 || block.htmlKind === 7)
                    ? 1
                    : 0;
            case "Paragraph":
            case "Table":
                return this.#blank ? 1 : 0;
            case "Heading":
            case "ThematicBreak":
                return 1;
            default:
                return 0;
        }
    }

    #incorporate(text: string): void {
        let container = this.#root;
        this.#oldTip = this.#tip;
        this.#offset = 0;
        this.#column = 0;
        this.#blank = false;
        this.#partialTab = false;
        this.#consumed = false;
        this.#lineNumber++;
        this.#line = text.includes("\0")
            ? text.replaceAll("\0", "\uFFFD")
            : text;

        for (;;) {
            const last = container.children.at(-1);
            if (!last?.open) break;
            container = last;
            this.#findNextNonspace();
            const result = this.#continue(container);
            if (result === 2) return;
            if (result === 1) {
                container = container.parent as Open;
                break;
            }
        }

        this.#allClosed = container === this.#oldTip;
        this.#lastMatched = container;
        this.#contentStart = this.#offset;
        let matchedLeaf =
            container.kind !== "Paragraph" &&
            container.kind !== "Table" &&
            (container.kind === "CodeBlock" || container.kind === "HtmlBlock");

        while (!matchedLeaf) {
            this.#findNextNonspace();
            if (!this.#indented && !/^[#`~*+_=<>0-9-|:]/.test(this.#rest())) {
                this.#advanceNextNonspace();
                break;
            }
            const result = this.#start(container);
            if (result === 0) {
                this.#advanceNextNonspace();
                break;
            }
            container = this.#tip;
            if (result === 1) this.#contentStart = this.#offset;
            if (result === 2) matchedLeaf = true;
        }

        if (
            !this.#allClosed &&
            !this.#blank &&
            this.#tip.kind === "Paragraph"
        ) {
            // a lazy continuation line
            this.#tip.lazy.add(this.#lineNumber);
            this.#addLine();
            for (
                let block: Open | null = this.#tip;
                block;
                block = block.parent
            )
                if (block.kind === "BlockQuote" || block.kind === "ListItem")
                    block.endLine = this.#lineNumber;
            return;
        }

        this.#closeUnmatched();
        const kind = container.kind;
        if (this.#consumed) return;
        if (kind === "CodeBlock" || kind === "HtmlBlock") {
            this.#addLine();
            if (
                kind === "HtmlBlock" &&
                container.htmlKind >= 1 &&
                container.htmlKind <= 5 &&
                htmlClose[container.htmlKind]?.test(
                    this.#line.slice(this.#offset),
                )
            )
                this.#close(container);
        } else if (kind === "Table") {
            if (!this.#blank) this.#addLine();
        } else if (kind === "Paragraph") {
            if (!this.#blank) this.#addLine();
        } else if (this.#offset < this.#line.length && !this.#blank) {
            this.#add("Paragraph", this.#nextNonspace);
            this.#advanceNextNonspace();
            this.#addLine();
        }
    }

    /** Tries to start a block: 0 none, 1 a container, 2 a leaf that takes the rest of the line. */
    #start(container: Open): number {
        const line = this.#line;
        const rest = this.#rest();
        const char = line[this.#nextNonspace];

        // block quote
        if (!this.#indented && char === ">") {
            this.#advanceNextNonspace();
            this.#advance(1);
            if (line[this.#offset] === " " || line[this.#offset] === "\t")
                this.#advance(1, true);
            this.#closeUnmatched();
            this.#add("BlockQuote", this.#nextNonspace);
            return 1;
        }

        if (!this.#indented) {
            // ATX heading
            const atx = /^#{1,6}(?:[ \t]+|$)/.exec(rest);
            if (atx) {
                const start = this.#nextNonspace;
                this.#advanceNextNonspace();
                this.#advance(atx[0].length);
                this.#closeUnmatched();
                const heading = this.#add("Heading", start);
                heading.level = atx[0].trim().length;
                heading.lines.push(
                    line
                        .slice(this.#offset)
                        .replace(/^[ \t]*#+[ \t]*$/, "")
                        .replace(/[ \t]+#+[ \t]*$/, ""),
                );
                heading.offsets.push(this.#lineStart + this.#offset);
                this.#advance(line.length - this.#offset);
                return 2;
            }

            // fenced code
            const fence = /^`{3,}(?!.*`)|^~{3,}/.exec(rest);
            if (fence) {
                const start = this.#nextNonspace;
                this.#closeUnmatched();
                const code = this.#add("CodeBlock", start);
                code.fence = fence[0];
                code.fenceOffset = this.#indent;
                code.info = rest.slice(fence[0].length).trim();
                this.#advanceNextNonspace();
                this.#advance(line.length - this.#offset);
                this.#consumed = true;
                return 2;
            }

            // HTML block
            if (char === "<") {
                for (let kind = 1; kind <= 7; kind++) {
                    if (
                        htmlOpen[kind]?.test(rest) &&
                        (kind < 7 ||
                            (container.kind !== "Paragraph" &&
                                !(
                                    !this.#allClosed &&
                                    !this.#blank &&
                                    this.#tip.kind === "Paragraph"
                                )))
                    ) {
                        this.#closeUnmatched();
                        const html = this.#add("HtmlBlock", this.#offset);
                        html.htmlKind = kind;
                        return 2;
                    }
                }
            }

            // like Biome, a table when the header has a pipe, before setext headings
            if (
                this.#gfm &&
                container.kind === "Paragraph" &&
                this.#allClosed &&
                delimiterRow.test(rest) &&
                rest.includes("-")
            ) {
                const header = container.lines.at(-1) ?? "";
                const delimiters = Blocks.cells(rest);
                if (
                    (rest.includes("|") || /(?:^|[^\\])\|/.test(header)) &&
                    Blocks.cells(header).length === delimiters.length
                ) {
                    this.#closeUnmatched();
                    this.#table(container, delimiters);
                    return 2;
                }
            }

            // setext heading
            if (
                container.kind === "Paragraph" &&
                /^(?:=+|-+)[ \t]*$/.test(rest)
            ) {
                this.#closeUnmatched();
                this.#takeDefinitions(container);
                if (container.lines.length > 0) {
                    container.info = rest.trim();
                    container.kind = "Heading";
                    container.setext = true;
                    container.level = char === "=" ? 1 : 2;
                    container.endLine = this.#lineNumber;
                    this.#advance(line.length - this.#offset);
                    return 2;
                }
            }

            // thematic break
            if (thematicBreak.test(rest)) {
                const start = this.#nextNonspace;
                this.#closeUnmatched();
                const block = this.#add("ThematicBreak", start);
                block.lines.push(rest.trimEnd());
                this.#advance(line.length - this.#offset);
                return 2;
            }
        }

        // list item
        if (!this.#indented || container.kind === "List") {
            const item = this.#listMarker(container);
            if (item) return 1;
        }

        // indented code
        if (this.#indented && this.#tip.kind !== "Paragraph" && !this.#blank) {
            this.#advance(4, true);
            this.#closeUnmatched();
            this.#add("CodeBlock", this.#offset);
            return 2;
        }

        return 0;
    }

    /** Turns the last line of a paragraph and the delimiter row into a table. */
    #table(paragraph: Open, delimiters: string[]): void {
        const headerLine = paragraph.lines.pop() as string;
        const headerOffset = paragraph.offsets.pop() as number;
        paragraph.indents.pop();
        paragraph.prefixes.pop();
        const parent = paragraph.parent as Open;
        const table = this.#create(
            "Table",
            parent,
            headerOffset,
            paragraph.line + paragraph.lines.length,
        );
        table.alignments = delimiters.map((cell) => {
            const left = cell.startsWith(":");
            const right = cell.endsWith(":");
            return left && right
                ? "center"
                : left
                  ? "left"
                  : right
                    ? "right"
                    : null;
        });
        table.lines.push(headerLine, this.#line.slice(this.#nextNonspace));
        table.offsets.push(headerOffset, this.#lineStart + this.#nextNonspace);
        table.endLine = this.#lineNumber;
        if (paragraph.lines.length === 0) {
            parent.children.splice(
                parent.children.indexOf(paragraph),
                1,
                table,
            );
        } else {
            paragraph.endLine = table.line - 1;
            paragraph.open = false;
            this.#takeDefinitions(paragraph);
            parent.children.push(table);
        }
        this.#tip = table;
        this.#advance(this.#line.length - this.#offset);
        this.#consumed = true;
    }

    #listMarker(container: Open): boolean {
        if (this.#indent >= 4) return false;
        const rest = this.#rest();
        const bullet = /^[*+-]/.exec(rest);
        const ordered = bullet ? null : /^(\d{1,9})([.)])/.exec(rest);
        const match = bullet ?? ordered;
        if (!match) return false;
        if (
            ordered &&
            container.kind === "Paragraph" &&
            Number(ordered[1]) !== 1
        )
            return false;
        const after = this.#line[this.#nextNonspace + match[0].length];
        if (after !== undefined && after !== " " && after !== "\t")
            return false;
        if (
            container.kind === "Paragraph" &&
            !/[^ \t]/.test(
                this.#line.slice(this.#nextNonspace + match[0].length),
            )
        )
            return false;

        const markerOffset = this.#indent;
        const start = this.#nextNonspace;
        this.#advanceNextNonspace();
        this.#advance(match[0].length, true);
        const spacesColumn = this.#column;
        const spacesOffset = this.#offset;
        let next: string | undefined;
        do {
            this.#advance(1, true);
            next = this.#line[this.#offset];
        } while (
            this.#column - spacesColumn < 5 &&
            (next === " " || next === "\t")
        );
        const blankItem = this.#line[this.#offset] === undefined;
        const spaces = this.#column - spacesColumn;
        const written =
            /^ */.exec(this.#line.slice(spacesOffset))?.[0].length ?? 0;
        let padding: number;
        if (spaces >= 5 || spaces < 1 || blankItem) {
            padding = match[0].length + 1;
            this.#column = spacesColumn;
            this.#offset = spacesOffset;
            this.#partialTab = false;
            const char = this.#line[this.#offset];
            if (char === " " || char === "\t") this.#advance(1, true);
        } else padding = match[0].length + spaces;

        this.#closeUnmatched();
        const delimiter = bullet ? match[0] : (ordered?.[2] as string);
        if (
            this.#tip.kind !== "List" ||
            this.#tip.ordered !== !!ordered ||
            this.#tip.delimiter !== delimiter
        ) {
            const list = this.#add("List", start);
            list.ordered = !!ordered;
            list.delimiter = delimiter;
        }
        const item = this.#add("ListItem", start);
        item.markerOffset = markerOffset;
        item.padding = padding;
        item.marker = match[0];
        item.number = ordered ? Number(ordered[1]) : null;
        item.spaces = blankItem
            ? 0
            : spaces >= 5 || written < 1
              ? 1
              : Math.min(written, spaces);
        return true;
    }

    /** Splits a table row into its cells, on pipes that are not escaped. */
    static cells(row: string): string[] {
        let text = row.trim();
        if (text.startsWith("|")) text = text.slice(1);
        if (text.endsWith("|") && !text.endsWith("\\|"))
            text = text.slice(0, -1);
        const cells: string[] = [];
        let cell = "";
        for (let index = 0; index < text.length; index++) {
            const char = text[index] as string;
            if (char === "\\" && text[index + 1] === "|") {
                cell += "\\|";
                index++;
            } else if (char === "|") {
                cells.push(cell.trim());
                cell = "";
            } else cell += char;
        }
        cells.push(cell.trim());
        return cells;
    }

    /** Link reference definitions at the start of a paragraph become blocks of their own. */
    #takeDefinitions(paragraph: Open): void {
        if (paragraph.lines.length === 0) return;
        const text = paragraph.lines.map((line) => line.trimStart()).join("\n");
        let position = 0;
        for (;;) {
            if (text[position] !== "[") break;
            const definition = Blocks.#definition(text, position);
            if (!definition) break;
            const [end, label, destination, title] = definition;
            const first = Blocks.#countLines(text, 0, position);
            const last = Blocks.#countLines(
                text,
                0,
                Math.max(end - 1, position),
            );
            const line = paragraph.lines[first] ?? "";
            paragraph.definitions.push({
                type: "Definition",
                indent: `${paragraph.indents[first] ?? ""}${/^[ \t]*/.exec(line)?.[0] ?? ""}`,
                start: paragraph.offsets[first] ?? paragraph.start,
                end:
                    (paragraph.offsets[last] ?? paragraph.start) +
                    (paragraph.lines[last]?.length ?? 0),
                line: paragraph.line + first,
                endLine: paragraph.line + last,
                label,
                destination,
                title,
            });
            position = end;
        }
        if (position === 0) return;
        const consumed =
            position >= text.length
                ? paragraph.lines.length
                : Blocks.#countLines(text, 0, position);
        paragraph.indents.splice(0, consumed);
        paragraph.prefixes.splice(0, consumed);
        paragraph.lines.splice(0, consumed);
        paragraph.offsets.splice(0, consumed);
        paragraph.line += consumed;
        paragraph.start = paragraph.offsets[0] ?? paragraph.start;
    }

    static #countLines(text: string, from: number, to: number): number {
        let count = 0;
        for (let index = from; index < to; index++)
            if (text[index] === "\n") count++;
        return count;
    }

    /** Parses a definition at a position, to the position after its line ending. */
    static #definition(
        text: string,
        from: number,
    ): [number, string, string, string | null] | undefined {
        const label = Blocks.#linkLabel(text, from);
        if (label === undefined || text[label] !== ":") return;
        const raw = text.slice(from, label);
        if (!/[^ \t\r\n[\]]/.test(raw.slice(1, -1))) return;
        let position = Blocks.#spaces(text, label + 1, true);
        const destination = Scan.destination(text, position);
        if (!destination) return;
        const [destinationEnd, destinationText] = destination;
        if (destinationText === "" && text[position] !== "<") return;
        position = destinationEnd;
        const beforeTitle = position;
        const afterSpaces = Blocks.#spaces(text, position, true);
        let title: string | null = null;
        let titleEnd = -1;
        if (afterSpaces !== position) {
            const parsed = Scan.title(text, afterSpaces);
            if (parsed !== undefined) {
                titleEnd = parsed;
                title = text.slice(afterSpaces, parsed);
            }
        }
        const lineEnd = (at: number): number | undefined => {
            let index = at;
            while (text[index] === " " || text[index] === "\t") index++;
            if (index >= text.length) return index;
            if (text[index] === "\n") return index + 1;
        };
        if (titleEnd >= 0) {
            const end = lineEnd(titleEnd);
            if (end !== undefined) return [end, raw, destinationText, title];
        }
        const end = lineEnd(beforeTitle);
        if (end === undefined) return;
        return [end, raw, destinationText, null];
    }

    /** The position after a link label `[...]`, if one starts at a position. */
    static #linkLabel(text: string, from: number): number | undefined {
        if (text[from] !== "[") return;
        for (
            let index = from + 1;
            index < text.length && index - from <= 1000;
            index++
        ) {
            const char = text[index];
            if (char === "\\") index++;
            else if (char === "[") return;
            else if (char === "]") return index + 1;
        }
    }

    static #spaces(text: string, from: number, newline: boolean): number {
        let index = from;
        let newlines = 0;
        while (index < text.length) {
            const char = text[index];
            if (char === "\n" && newline && newlines === 0) newlines++;
            else if (char !== " " && char !== "\t") break;
            index++;
        }
        return index;
    }

    // finishing

    #blocks(parent: Open, definitions: Map<string, Definition>): Block[] {
        const blocks: Block[] = [];
        for (const child of parent.children) {
            for (const definition of child.definitions) {
                blocks.push(definition);
                const key = Scan.label(definition.label);
                if (!definitions.has(key)) definitions.set(key, definition);
            }
            const block = this.#block(child, definitions);
            if (block) blocks.push(block);
        }
        return blocks;
    }

    #end(block: Open): number {
        const line = this.#lines[block.endLine - 1];
        return line ? line.start + line.text.length : this.#source.length;
    }

    #block(
        open: Open,
        definitions: Map<string, Definition>,
    ): Block | undefined {
        const base = {
            start: open.start,
            end: Math.max(this.#end(open), open.start),
            line: open.line,
            endLine: open.endLine,
        };
        switch (open.kind) {
            case "Paragraph": {
                if (open.lines.length === 0) return;
                const text = open.lines
                    .map((line) => line.trimStart())
                    .join("\n");
                return {
                    type: "Paragraph",
                    ...base,
                    text: text.replace(/[ \t]+$/, ""),
                    indents: open.lines.map(
                        (line, index) =>
                            `${open.indents[index] ?? ""}${/^[ \t]*/.exec(line)?.[0] ?? ""}`,
                    ),
                    prefixes: open.prefixes,
                    lazy: open.lines.map((_, index) =>
                        open.lazy.has(open.line + index),
                    ),
                    children: [],
                } satisfies Paragraph;
            }
            case "Heading": {
                const text = open.setext
                    ? open.lines.map((line) => line.trim()).join("\n")
                    : (open.lines[0] ?? "").trimStart();
                return {
                    type: "Heading",
                    ...base,
                    level: open.level,
                    setext: open.setext,
                    text,
                    underline: open.setext ? open.info : "",
                    children: [],
                } satisfies Heading;
            }
            case "ThematicBreak":
                return {
                    type: "ThematicBreak",
                    ...base,
                    raw: open.lines[0] ?? "",
                } satisfies ThematicBreak;
            case "CodeBlock":
                return {
                    type: "CodeBlock",
                    ...base,
                    fence: open.fence,
                    indent: open.fenceOffset,
                    info: open.info,
                    lines: open.lines,
                    prefixes: open.prefixes,
                    closed: open.closed,
                } satisfies CodeBlock;
            case "HtmlBlock":
                return {
                    type: "HtmlBlock",
                    ...base,
                    kind: open.htmlKind,
                    lines: open.lines,
                } satisfies HtmlBlock;
            case "BlockQuote":
                return {
                    type: "BlockQuote",
                    ...base,
                    children: this.#blocks(open, definitions),
                } satisfies BlockQuote;
            case "List": {
                const items = open.children.map(
                    (item) =>
                        this.#block(item, definitions) as ListItem & Block,
                );
                return {
                    type: "List",
                    ...base,
                    ordered: open.ordered,
                    delimiter: open.delimiter,
                    tight: Blocks.#tight(items),
                    children: items as unknown as ListItem[],
                } satisfies List;
            }
            case "ListItem": {
                const children = this.#blocks(open, definitions);
                let checked: boolean | null = null;
                const first = children[0];
                const task =
                    this.#gfm && first?.type === "Paragraph"
                        ? /^\[([ xX])\](?=[ \t]|$)/.exec(first.text)
                        : null;
                if (
                    task &&
                    first?.type === "Paragraph" &&
                    first.line === open.line
                ) {
                    checked = task[1] !== " ";
                }
                return {
                    type: "ListItem",
                    ...base,
                    marker: open.marker,
                    number: open.number,
                    indent: open.markerOffset,
                    spaces: open.spaces,
                    checked,
                    children,
                } satisfies ListItem as unknown as Block;
            }
            case "Table": {
                const rows: TableRow[] = open.lines
                    .map((line, index) => ({ line, index }))
                    .filter(({ index }) => index !== 1)
                    .map(({ line, index }) => {
                        const start = open.offsets[index] ?? open.start;
                        return {
                            type: "TableRow",
                            start,
                            end: start + line.length,
                            line: open.line + index,
                            endLine: open.line + index,
                            cells: Blocks.cells(line).map((text) => ({
                                type: "TableCell",
                                start,
                                end: start + line.length,
                                text,
                                children: [],
                            })),
                        };
                    });
                return {
                    type: "Table",
                    ...base,
                    alignments: open.alignments,
                    rows,
                } satisfies Table;
            }
        }
    }

    /** Lists are loose when blank lines separate items, or blocks of an item. */
    static #tight(items: ListItem[]): boolean {
        for (const [index, item] of items.entries()) {
            const next = items[index + 1];
            if (next && next.line > item.endLine + 1) return false;
            for (const [position, child] of item.children.entries()) {
                const sibling = item.children[position + 1];
                if (sibling && sibling.line > child.endLine + 1) return false;
            }
        }
        return true;
    }

    static #inlines(blocks: Block[], inlines: Inlines): void {
        for (const block of blocks) {
            switch (block.type) {
                case "Paragraph":
                case "Heading":
                    block.children = inlines.parse(block.text);
                    break;
                case "Table":
                    for (const row of block.rows)
                        for (const cell of row.cells)
                            cell.children = inlines.parse(cell.text);
                    break;
                case "BlockQuote":
                    Blocks.#inlines(block.children, inlines);
                    break;
                case "List":
                    for (const item of block.children)
                        Blocks.#inlines(item.children, inlines);
                    break;
            }
        }
    }
}
