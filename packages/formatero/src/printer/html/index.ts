import type { Html as Tree } from "@aljazmc/syntax";
import { ParseError, parseHtml } from "@aljazmc/syntax";
import {
    blockIndent,
    embed,
    emptyLine,
    expandParent,
    fill,
    group,
    hardLine,
    type IR,
    ifGroupBreaks,
    ifGroupFitsOnLine,
    indent,
    Printer,
    softBlockIndent,
    softLine,
    softLineIndentOrSpace,
    softLineOrSpace,
    space,
    text,
    willBreak,
} from "./ir.js";
import { srcset } from "./srcset.js";
import {
    attributesByTag,
    canonicalTags,
    displays,
    globalAttributes,
    mathmlTags,
} from "./tables.js";

export interface HtmlOptions {
    lineWidth: number;
    indentWidth: number;
    useTabs: boolean;
    attributePosition: "auto" | "multiline";
    bracketSameLine: boolean;
    indentScriptAndStyle: boolean;
    selfCloseVoidElements: "always" | "never";
    whitespaceSensitivity: "css" | "ignore" | "strict";
    trailingNewline: boolean;
    /**
     * Formats the code of a script or style at an indentation level, `json`
     * for import maps and JSON, undefined to keep it as written.
     */
    embed?: (
        code: string,
        language: "javascript" | "module" | "json" | "css",
        level: number,
    ) => string | undefined;
}

type Display =
    | "block"
    | "inline"
    | "inline-block"
    | "list-item"
    | "table"
    | "table-cell"
    | "table-row"
    | "table-row-group"
    | "table-header-group"
    | "table-footer-group"
    | "table-column"
    | "table-column-group"
    | "table-caption"
    | "ruby"
    | "ruby-base"
    | "ruby-text"
    | "none";

type NonText = Tree.Element | Tree.Cdata;

/** A child of an element, split like Biome's `HtmlChild`. */
type Child =
    | { kind: "word"; text: string }
    | { kind: "comment"; text: string }
    | { kind: "whitespace" }
    | { kind: "newline" }
    | { kind: "emptyLine" }
    | { kind: "segmentBreak" }
    | { kind: "nonText"; node: NonText }
    | Verbatim;

/** A node kept as written, after a `biome-ignore format` comment. */
interface Verbatim {
    kind: "verbatim";
    node: Tree.Child;
}

/** A comment or whitespace between tokens. */
type Piece = { comment: false; text: string } | { comment: true; text: string };

const BLOCK_LIKE = new Set<Display>([
    "block",
    "list-item",
    "table",
    "table-row",
    "table-row-group",
    "table-header-group",
    "table-footer-group",
    "table-column",
    "table-column-group",
    "table-caption",
    "table-cell",
    "none",
]);
const INLINE_LIKE = new Set<Display>([
    "inline",
    "inline-block",
    "ruby",
    "ruby-base",
    "ruby-text",
]);
const TABLE_LIKE = new Set<Display>([
    "table",
    "table-cell",
    "table-row",
    "table-row-group",
    "table-header-group",
    "table-footer-group",
    "table-column",
    "table-column-group",
    "table-caption",
]);
const FORCE_BREAK_CHILDREN = new Set(["html", "head", "ul", "ol", "select"]);
const STRUCTURAL_FALLBACK = new Set(["audio", "object", "video"]);
const PRESERVES_CONTENT = new Set(["pre", "plaintext", "xmp", "textarea"]);

/** Formats HTML like Biome. */
export default class Html {
    readonly #options: HtmlOptions;
    #source = "";
    #root: Tree.Root | undefined;
    #comments: Tree.Comment[] = [];
    #parents = new Map<
        Tree.Element | Tree.Cdata | Tree.Text,
        Tree.Element | null
    >();

    constructor(options: HtmlOptions) {
        this.#options = options;
    }

    format(source: string): string {
        this.#source = source;
        const root = parseHtml(source);
        this.#root = root;
        this.#comments = root.comments;
        this.#parents = new Map();
        // like Biome, a file with `biome-ignore-all format` stays as written
        if (
            root.comments.some((comment) =>
                /^<!--\s*biome-ignore-all\s+format\b/.test(comment.value),
            )
        )
            return source;
        const link = (children: Tree.Child[], parent: Tree.Element | null) => {
            for (const child of children) {
                this.#parents.set(child, parent);
                if (child.type === "Element") link(child.children, child);
            }
        };
        link(root.children, null);
        return new Printer({
            lineWidth: this.#options.lineWidth,
            indentWidth: this.#options.indentWidth,
            useTabs: this.#options.useTabs,
        }).print(this.#rootIR(root));
    }

    // ---- trivia ----

    /** The comments and whitespace between two offsets. */
    #pieces(start: number, end: number): Piece[] {
        const pieces: Piece[] = [];
        let position = start;
        while (position < end) {
            const comment = this.#comments.find(
                (candidate) => candidate.start === position,
            );
            if (comment) {
                pieces.push({ comment: true, text: comment.value });
                position = comment.end;
                continue;
            }
            let next = position;
            while (next < end && !this.#source.startsWith("<!--", next)) next++;
            pieces.push({
                comment: false,
                text: this.#source.slice(position, next),
            });
            position = next;
        }
        return pieces;
    }

    /** Splits a gap into the trailing trivia of the token before, up to the first newline, and the leading trivia of the token after. */
    #split(
        start: number,
        end: number,
    ): { trailing: Piece[]; leading: Piece[] } {
        const trailing: Piece[] = [];
        const leading: Piece[] = [];
        let inLeading = false;
        for (const piece of this.#pieces(start, end)) {
            if (inLeading || piece.comment) {
                (inLeading ? leading : trailing).push(piece);
                continue;
            }
            const newline = piece.text.search(/[\r\n]/);
            if (newline < 0) trailing.push(piece);
            else {
                if (newline > 0)
                    trailing.push({
                        comment: false,
                        text: piece.text.slice(0, newline),
                    });
                leading.push({
                    comment: false,
                    text: piece.text.slice(newline),
                });
                inLeading = true;
            }
        }
        return { trailing, leading };
    }

    static #hasWhitespace(pieces: Piece[]): boolean {
        return pieces.some((piece) => !piece.comment && piece.text.length > 0);
    }

    static #hasNewline(pieces: Piece[]): boolean {
        return pieces.some(
            (piece) => !piece.comment && /[\r\n]/.test(piece.text),
        );
    }

    static #text(pieces: Piece[]): string {
        return pieces.map((piece) => piece.text).join("");
    }

    /** The offset where the trivia before a child starts: the end of the previous token. */
    #before(node: Tree.Child): number {
        const parent = this.#parents.get(node) ?? null;
        const siblings = parent
            ? parent.children
            : (this.#root?.children ?? []);
        const index = siblings.indexOf(node);
        if (index > 0) return (siblings[index - 1] as Tree.Child).end;
        if (parent) return parent.openingEnd;
        const root = this.#root as Tree.Root;
        return root.doctype?.end ?? root.instruction?.end ?? (root.bom ? 1 : 0);
    }

    /** The offset where the trivia after a child ends: the start of the next token. */
    #after(node: Tree.Child): number {
        const parent = this.#parents.get(node) ?? null;
        const siblings = parent
            ? parent.children
            : (this.#root?.children ?? []);
        const index = siblings.indexOf(node);
        if (index < siblings.length - 1)
            return (siblings[index + 1] as Tree.Child).start;
        if (parent) return parent.closing?.start ?? parent.end;
        return this.#source.length;
    }

    #leading(node: Tree.Child): Piece[] {
        const root = this.#root as Tree.Root;
        // with no token before, all the trivia at the start of the file leads
        if (root.children[0] === node && !root.doctype && !root.instruction)
            return this.#pieces(this.#before(node), node.start);
        return this.#split(this.#before(node), node.start).leading;
    }

    #trailing(node: Tree.Child): Piece[] {
        return this.#split(node.end, this.#after(node)).trailing;
    }

    // ---- display ----

    #whitespace(): HtmlOptions["whitespaceSensitivity"] {
        return this.#options.whitespaceSensitivity;
    }

    static #displayOf(element: Tree.Element): Display {
        if (element.tag) {
            const display = displays[element.tag];
            if (display) return display as Display;
            return "inline";
        }
        return mathmlTags.has(element.name.toLowerCase()) ? "block" : "inline";
    }

    static #display(node: NonText): Display {
        return node.type === "Element" ? Html.#displayOf(node) : "inline";
    }

    static #childDisplay(node: Tree.Child): Display {
        return node.type === "Text" ? "inline" : Html.#display(node);
    }

    /** Whether a comment suppresses formatting of the next node. */
    static #suppression(comment: string): boolean {
        return /^<!--\s*biome-ignore\s+format\b/.test(comment);
    }

    /** Whether the last comment before a node suppresses its formatting. */
    #suppressed(node: Tree.Child): boolean {
        const comments = this.#pieces(this.#before(node), node.start).filter(
            (piece) => piece.comment,
        );
        const last = comments.at(-1);
        return last !== undefined && Html.#suppression(last.text);
    }

    /** A node as written, with its comments, Biome's `format_verbatim_skipped`. */
    #verbatim(node: Tree.Child): IR {
        const parts: IR[] = [];
        const before = this.#pieces(this.#before(node), node.start);
        const trailingOfPrevious = this.#split(
            this.#before(node),
            node.start,
        ).trailing;
        // the comments the split skipped: the leading ones, and a suppression at the end of the previous line
        const lastTrailing = trailingOfPrevious
            .filter((piece) => piece.comment)
            .at(-1);
        const leadingCount = this.#leading(node).filter(
            (piece) => piece.comment,
        ).length;
        const comments = before.filter((piece) => piece.comment);
        const printed = comments.slice(
            comments.length -
                leadingCount -
                (lastTrailing && Html.#suppression(lastTrailing.text) ? 1 : 0),
        );
        for (const comment of printed) {
            parts.push(text(comment.text));
            const index = before.indexOf(comment);
            let newlines = 0;
            for (const piece of before.slice(index + 1)) {
                if (piece.comment) break;
                newlines += (piece.text.match(/\n/g) ?? []).length;
            }
            if (newlines === 1) parts.push(hardLine);
            else if (newlines > 1) parts.push(emptyLine);
        }
        parts.push(
            text(
                this.#source
                    .slice(node.start, node.end)
                    .replace(/\r\n?/g, "\n"),
            ),
        );
        for (const piece of this.#trailing(node))
            if (piece.comment) parts.push(text(piece.text));
        return parts;
    }

    #internallySensitive(display: Display): boolean {
        const sensitivity = this.#whitespace();
        return (
            (sensitivity === "css" &&
                !BLOCK_LIKE.has(display) &&
                display !== "inline-block") ||
            sensitivity === "strict"
        );
    }

    #externallySensitive(display: Display): boolean {
        const sensitivity = this.#whitespace();
        return (
            (sensitivity === "css" && INLINE_LIKE.has(display)) ||
            sensitivity === "strict"
        );
    }

    // ---- root ----

    #rootIR(root: Tree.Root): IR {
        const parts: IR[] = [];
        if (root.bom) parts.push("\uFEFF");
        let position = root.bom ? 1 : 0;
        if (root.instruction) {
            parts.push(this.#leadingComments(position, root.instruction.start));
            parts.push(group(this.#instruction(root.instruction)), hardLine);
            position = root.instruction.end;
        }
        if (root.doctype) {
            parts.push(this.#leadingComments(position, root.doctype.start));
            parts.push(this.#doctype(root.doctype));
            position = root.doctype.end;
        }
        parts.push(
            this.#list(root.children, null, {
                layout: "bestFitting",
                sensitive: false,
            }),
        );
        const last = root.children.at(-1);
        const split = this.#split(last?.end ?? position, this.#source.length);
        // past the trailing trivia of the last child, comments lead the end of the file
        const eof = last
            ? split.leading
            : [...split.trailing, ...split.leading];
        let newlines = 0;
        for (const piece of eof) {
            if (!piece.comment) {
                newlines += (piece.text.match(/\n/g) ?? []).length;
                continue;
            }
            parts.push(
                newlines > 1 ? emptyLine : newlines === 1 ? hardLine : space,
            );
            parts.push(text(piece.text));
            newlines = 0;
        }
        if (this.#options.trailingNewline) parts.push(hardLine);
        return parts;
    }

    /** Comments before a node that starts a line, each on its own line, blank lines kept. */
    #leadingComments(start: number, end: number): IR {
        const pieces = this.#pieces(start, end);
        const parts: IR[] = [];
        for (const [index, piece] of pieces.entries()) {
            if (!piece.comment) continue;
            const after = pieces[index + 1];
            const newlines =
                after && !after.comment
                    ? (after.text.match(/\n/g) ?? []).length
                    : 0;
            parts.push(text(piece.text), newlines > 1 ? emptyLine : hardLine);
        }
        return parts;
    }

    #doctype(doctype: Tree.Doctype): IR {
        // like Biome, a declaration that is no doctype cannot be formatted
        if (doctype.keyword.toLowerCase() !== "doctype")
            throw new ParseError("Syntax error.", doctype.start);
        const bare =
            doctype.name?.toLowerCase() === "html" &&
            doctype.literal === null &&
            doctype.identifiers.length === 0;
        const parts: IR[] = [
            "<!",
            bare ? doctype.keyword.toLowerCase() : doctype.keyword,
        ];
        if (doctype.name)
            parts.push(
                space,
                doctype.name.toLowerCase() === "html" ? "html" : doctype.name,
            );
        if (doctype.literal) parts.push(space, doctype.literal);
        for (const identifier of doctype.identifiers)
            parts.push(space, identifier);
        parts.push(">", hardLine);
        return parts;
    }

    #instruction(instruction: Tree.Instruction): IR {
        return [
            "<?",
            instruction.name,
            space,
            this.#attributes(instruction.attributes, null),
            space,
            "?>",
        ];
    }

    // ---- children ----

    /** Splits children into words, comments, whitespace and elements, Biome's `html_split_children`. */
    #children(children: Tree.Child[], parent: Tree.Element | null): Child[] {
        const buffer: Child[] = [];
        const entry = (child: Child) => {
            const startedOnNewLine =
                buffer[0]?.kind === "newline" ||
                buffer[0]?.kind === "emptyLine";
            const last = buffer.at(-1);
            if (
                last &&
                (last.kind === "emptyLine" ||
                    last.kind === "newline" ||
                    last.kind === "whitespace")
            ) {
                switch (child.kind) {
                    case "emptyLine":
                        buffer[buffer.length - 1] = child;
                        return;
                    case "newline":
                        if (startedOnNewLine && last.kind === "whitespace")
                            buffer[buffer.length - 1] = child;
                        return;
                    case "whitespace":
                        if (last.kind !== "emptyLine")
                            buffer[buffer.length - 1] = child;
                        return;
                    default:
                        buffer.push(child);
                        return;
                }
            }
            buffer.push(child);
        };
        const nonTextEntry = (
            child: Child & { kind: "nonText" | "verbatim" },
        ) => {
            const previous = buffer.at(-2);
            if (
                !this.#externallySensitive(Html.#childDisplay(child.node)) &&
                buffer.at(-1)?.kind === "whitespace" &&
                (previous?.kind === "word" || previous?.kind === "comment")
            )
                buffer.pop();
            entry(child);
        };
        const trivia = (pieces: Piece[], skipComments = false) => {
            let has = false;
            let newlines = 0;
            const flush = () => {
                if (newlines >= 2) entry({ kind: "emptyLine" });
                else if (newlines === 1) entry({ kind: "newline" });
                else if (has) entry({ kind: "whitespace" });
                has = false;
                newlines = 0;
            };
            for (const piece of pieces) {
                if (!piece.comment) {
                    if (piece.text.length > 0) has = true;
                    newlines += (piece.text.match(/\n/g) ?? []).length;
                    continue;
                }
                flush();
                // suppression comments are printed with the node they keep
                if (skipComments || Html.#suppression(piece.text)) continue;
                entry({ kind: "comment", text: piece.text });
            }
            flush();
        };

        if (parent)
            trivia(
                this.#split(parent.openingEnd, this.#after2(parent)).trailing,
            );
        let previousWasContent = false;
        for (const child of children) {
            const suppressed = this.#suppressed(child);
            if (child.type === "Text" && suppressed) {
                entry({ kind: "verbatim", node: child });
                continue;
            }
            if (child.type === "Text") {
                const value =
                    Html.#text(this.#leading(child)) +
                    child.value +
                    Html.#text(this.#trailing(child));
                const chunks = Html.#chunks(value);
                let index = 0;
                const first = chunks[0];
                if (first?.kind === "whitespace") {
                    index++;
                    const next = chunks[index];
                    const previous = buffer.at(-1);
                    const segmentBreak =
                        previousWasContent &&
                        previous?.kind === "word" &&
                        next?.kind === "word" &&
                        Html.#cjkBreak(previous.text, first.text, next.text);
                    const newlines = (first.text.match(/\n/g) ?? []).length;
                    if (segmentBreak) entry({ kind: "segmentBreak" });
                    else if (first.text.includes("\n") && !previousWasContent) {
                        if (next === undefined) {
                            if (newlines > 1) entry({ kind: "emptyLine" });
                            continue;
                        }
                        entry({ kind: newlines > 1 ? "emptyLine" : "newline" });
                    } else if (
                        first.text.includes("\n") &&
                        next?.kind === "comment"
                    )
                        entry({ kind: newlines > 1 ? "emptyLine" : "newline" });
                    else entry({ kind: "whitespace" });
                }
                let previousComment = false;
                let previousWord: string | undefined;
                for (; index < chunks.length; index++) {
                    const chunk = chunks[index] as (typeof chunks)[number];
                    if (chunk.kind === "whitespace") {
                        const newlines = (chunk.text.match(/\n/g) ?? []).length;
                        const next = chunks[index + 1];
                        if (next?.kind === "comment")
                            entry({
                                kind:
                                    newlines >= 2
                                        ? "emptyLine"
                                        : newlines === 1
                                          ? "newline"
                                          : "whitespace",
                            });
                        else if (next === undefined)
                            entry({
                                kind: newlines >= 1 ? "newline" : "whitespace",
                            });
                        else if (next.kind === "word") {
                            if (
                                previousWord !== undefined &&
                                Html.#cjkBreak(
                                    previousWord,
                                    chunk.text,
                                    next.text,
                                )
                            )
                                entry({ kind: "segmentBreak" });
                            else if (previousComment)
                                entry({
                                    kind:
                                        newlines >= 2
                                            ? "emptyLine"
                                            : newlines === 1
                                              ? "newline"
                                              : "whitespace",
                                });
                        }
                    } else if (chunk.kind === "word") {
                        entry({ kind: "word", text: chunk.text });
                        previousWord = chunk.text;
                    } else if (!Html.#suppression(chunk.text))
                        entry({ kind: "comment", text: chunk.text });
                    previousComment = chunk.kind === "comment";
                    if (previousComment) previousWord = undefined;
                }
                previousWasContent = true;
                continue;
            }
            const leading = this.#leading(child);
            let has = false;
            let newlines = 0;
            for (const piece of leading) {
                if (piece.comment) break;
                for (const char of piece.text) {
                    if (char === "\n") newlines++;
                    has = true;
                }
            }
            if (has)
                entry({
                    kind:
                        newlines > 1
                            ? "emptyLine"
                            : newlines === 1
                              ? "newline"
                              : "whitespace",
                });
            trivia(leading, suppressed);
            if (suppressed) nonTextEntry({ kind: "verbatim", node: child });
            else nonTextEntry({ kind: "nonText", node: child });
            trivia(this.#trailing(child), suppressed);
            previousWasContent = false;
        }
        if (parent?.closing) {
            const last = children.at(-1);
            trivia(
                this.#split(
                    last?.end ?? parent.openingEnd,
                    parent.closing.start,
                ).leading,
            );
        }
        return buffer;
    }

    /** The end of the gap after the opening tag: the first child or the closing tag. */
    #after2(element: Tree.Element): number {
        return (
            element.children[0]?.start ?? element.closing?.start ?? element.end
        );
    }

    /** Splits text with its trivia into words, whitespace and comments. */
    static #chunks(
        value: string,
    ): { kind: "word" | "whitespace" | "comment"; text: string }[] {
        const chunks: {
            kind: "word" | "whitespace" | "comment";
            text: string;
        }[] = [];
        let position = 0;
        while (position < value.length) {
            if (value.startsWith("<!--", position)) {
                const close = value.indexOf("-->", position + 4);
                const end = close < 0 ? value.length : close + 3;
                chunks.push({
                    kind: "comment",
                    text: value.slice(position, end),
                });
                position = end;
                continue;
            }
            const whitespace = /[ \n\t\r]/.test(value[position] as string);
            let end = position + 1;
            while (
                end < value.length &&
                /[ \n\t\r]/.test(value[end] as string) === whitespace &&
                !value.startsWith("<!--", end)
            )
                end++;
            chunks.push({
                kind: whitespace ? "whitespace" : "word",
                text: value.slice(position, end),
            });
            position = end;
        }
        return chunks;
    }

    /** Whether a line break between CJK text renders as nothing and must be kept. */
    static #cjkBreak(
        before: string,
        whitespace: string,
        after: string,
    ): boolean {
        if (!/[\n\r]/.test(whitespace)) return false;
        const ignorable = /\p{Default_Ignorable_Code_Point}/u;
        const last = [...before]
            .reverse()
            .find((char) => !ignorable.test(char));
        const first = [...after].find((char) => !ignorable.test(char));
        if (!last || !first) return false;
        // Chinese and Japanese characters, which break lines without spaces, not Korean
        const segment =
            /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Bopomofo}\u3000-\u303f\uff00-\uffef]/u;
        const punctuation =
            /[\u3000-\u303f\uff01-\uff0f\uff1a-\uff20\uff3b-\uff40\uff5b-\uff65\ufe10-\ufe1f\ufe30-\ufe4f]/u;
        return (
            (segment.test(last) && segment.test(first)) ||
            punctuation.test(last) ||
            punctuation.test(first)
        );
    }

    // ---- element list ----

    #list(
        nodes: Tree.Child[],
        parent: Tree.Element | null,
        options: {
            layout: "bestFitting" | "multiline";
            sensitive: boolean;
            borrowedRAngle?: boolean;
            borrowedClosing?: Tree.Element;
        },
    ): IR {
        if (nodes.length === 0) return "";
        let children = this.#children(nodes, parent);

        let blockCount = 0;
        let hasBlock = false;
        let hasNonText = false;
        let hasWord = false;
        for (const child of children) {
            if (child.kind === "nonText") {
                hasNonText = true;
                if (BLOCK_LIKE.has(Html.#display(child.node))) {
                    hasBlock = true;
                    blockCount++;
                }
            } else if (child.kind === "verbatim") {
                hasNonText = true;
                blockCount++;
            } else if (child.kind === "comment") hasNonText = true;
            else if (child.kind === "word") hasWord = true;
        }

        const isLineBreak = (child: Child | undefined) =>
            child?.kind === "newline" || child?.kind === "emptyLine";
        const isWhitespace = (child: Child | undefined) =>
            child?.kind === "whitespace" ||
            child?.kind === "newline" ||
            child?.kind === "emptyLine" ||
            child?.kind === "segmentBreak";
        if (!options.sensitive)
            while (isLineBreak(children.at(-1)))
                children = children.slice(0, -1);

        const parts: IR[] = [];
        if (options.borrowedRAngle) parts.push(">");
        let forceMultiline = options.layout === "multiline" || blockCount > 1;

        let index = 0;
        let hadLeadingNewline = false;
        if (!options.sensitive)
            while (isLineBreak(children[index])) {
                hadLeadingNewline = true;
                index++;
            }
        if (hadLeadingNewline && (hasBlock || (hasNonText && !hasWord)))
            forceMultiline = true;

        if (forceMultiline) parts.push(expandParent);
        let last: Child | undefined;
        let lastHadTrailingLine = false;
        let previousInlineGroup: symbol | undefined;
        let borrowedSiblingRAngle = false;
        let borrowedClosing = options.borrowedClosing;
        let first = true;

        while (index < children.length) {
            const child = children[index] as Child;
            index++;
            let childBreaks = false;
            const isLast = index >= children.length;
            const peek = () => children[index];
            const peekNext = () => children[index + 1];

            if (options.sensitive && isWhitespace(child)) {
                if (first || isLast) {
                    parts.push(forceMultiline ? hardLine : softLineOrSpace);
                    first = false;
                    last = child;
                    continue;
                }
            }

            switch (child.kind) {
                case "word": {
                    if (borrowedSiblingRAngle) {
                        parts.push(">");
                        borrowedSiblingRAngle = false;
                    }
                    const entries: IR[] = [];
                    let lastWord = child.text;
                    for (;;) {
                        const next = peek();
                        if (next?.kind === "word") {
                            entries.push(lastWord, softLineOrSpace);
                            lastWord = next.text;
                            index++;
                        } else if (
                            next &&
                            (next.kind === "whitespace" ||
                                next.kind === "newline" ||
                                next.kind === "emptyLine") &&
                            peekNext()?.kind === "word"
                        )
                            index++;
                        else break;
                    }
                    if (
                        peek() === undefined &&
                        options.sensitive &&
                        borrowedClosing
                    ) {
                        entries.push([
                            lastWord,
                            this.#partialClosing(borrowedClosing),
                        ]);
                        borrowedClosing = undefined;
                    } else entries.push(lastWord);
                    parts.push(fill(entries));

                    const next = peek();
                    if (next?.kind === "nonText") {
                        const display = Html.#display(next.node);
                        if (
                            !this.#externallySensitive(display) &&
                            !INLINE_LIKE.has(display)
                        ) {
                            if (BLOCK_LIKE.has(display) && display !== "none") {
                                childBreaks = true;
                                forceMultiline = true;
                                parts.push(hardLine);
                            } else if (display === "none") {
                                // no whitespace around hidden elements
                            } else
                                parts.push(
                                    forceMultiline ? hardLine : softLine,
                                );
                        }
                    }
                    break;
                }
                case "comment": {
                    parts.push(text(child.text));
                    const next = peek();
                    if (
                        next?.kind === "nonText" &&
                        !this.#externallySensitive(Html.#display(next.node))
                    )
                        parts.push(hardLine);
                    break;
                }
                case "whitespace": {
                    const next = peek();
                    if (last?.kind === "nonText" && Html.#isBr(last.node))
                        parts.push(hardLine);
                    else if (
                        last?.kind === "nonText" &&
                        next?.kind === "nonText"
                    ) {
                        if (
                            !(
                                this.#externallySensitive(
                                    Html.#display(last.node),
                                ) &&
                                this.#externallySensitive(
                                    Html.#display(next.node),
                                )
                            )
                        )
                            parts.push(softLineOrSpace);
                    } else if (last?.kind === "nonText") {
                        const display = Html.#display(last.node);
                        if (lastHadTrailingLine) {
                            // the group of the element added the space
                        } else if (
                            forceMultiline &&
                            next?.kind === "word" &&
                            BLOCK_LIKE.has(display) &&
                            display !== "none"
                        ) {
                            childBreaks = true;
                            parts.push(hardLine);
                        } else if (this.#externallySensitive(display))
                            parts.push(softLineOrSpace);
                        else parts.push(space);
                    } else if (
                        next === undefined &&
                        last !== undefined &&
                        !options.sensitive
                    ) {
                        // trailing whitespace of a container that is not sensitive
                    } else if (first && !options.sensitive) {
                        // leading whitespace of a container that is not sensitive
                    } else parts.push(space);
                    break;
                }
                case "newline": {
                    let soft = false;
                    if (last?.kind === "word") {
                        const next = peek();
                        const selfClosing =
                            next?.kind === "nonText" &&
                            Html.#isSelfClosingOrBr(next.node);
                        soft = !selfClosing && [...last.text].length === 1;
                    } else {
                        const next = peek();
                        if (next?.kind === "word") {
                            const after = peekNext();
                            const selfClosing =
                                after?.kind === "nonText" &&
                                Html.#isSelfClosingOrBr(after.node);
                            soft = !selfClosing && [...next.text].length === 1;
                        }
                    }
                    if (soft) parts.push(softLineOrSpace);
                    else {
                        childBreaks = true;
                        parts.push(hardLine);
                    }
                    break;
                }
                case "verbatim":
                    parts.push(this.#verbatim(child.node));
                    break;
                case "segmentBreak":
                    childBreaks = true;
                    parts.push(hardLine);
                    break;
                case "emptyLine":
                    childBreaks = true;
                    parts.push(emptyLine);
                    break;
                case "nonText": {
                    const node = child.node;
                    const id = Symbol("non text child");
                    const display = Html.#display(node);
                    const sensitive = this.#externallySensitive(display);
                    const next = peek();
                    const needsOuterGroup =
                        sensitive && last?.kind === "whitespace";
                    const trailingLineInInner =
                        needsOuterGroup &&
                        (next?.kind === "whitespace" ||
                            next?.kind === "newline");
                    const nextIsAdjacentInline =
                        next?.kind === "nonText" &&
                        sensitive &&
                        this.#externallySensitive(Html.#display(next.node));
                    const closesWithRAngle =
                        node.type === "Element" && node.closing !== null;
                    const nextWordBorrows =
                        next?.kind === "word" && sensitive && closesWithRAngle;

                    let lineMode: "soft" | "hard" | undefined;
                    if (next?.kind === "word") {
                        if (nextWordBorrows) lineMode = "soft";
                        else if (sensitive) lineMode = undefined;
                        else if (BLOCK_LIKE.has(display) && display !== "none")
                            lineMode = "hard";
                        else lineMode = "soft";
                    } else if (next?.kind === "nonText") {
                        lineMode =
                            sensitive &&
                            this.#externallySensitive(Html.#display(next.node))
                                ? undefined
                                : "hard";
                    } else if (next?.kind === "comment")
                        lineMode = sensitive ? undefined : "soft";
                    else if (next?.kind === "verbatim")
                        lineMode =
                            sensitive &&
                            this.#externallySensitive(
                                Html.#childDisplay(next.node),
                            )
                                ? undefined
                                : "hard";
                    else lineMode = undefined;
                    childBreaks = lineMode === "hard";

                    const placement: "inside" | "outside" = nextWordBorrows
                        ? "inside"
                        : forceMultiline
                          ? "outside"
                          : lineMode === "hard"
                            ? "outside"
                            : "inside";
                    const separator = (where: "inside" | "outside"): IR =>
                        lineMode !== undefined && placement === where
                            ? lineMode === "hard"
                                ? hardLine
                                : softLine
                            : "";

                    const conditional = previousInlineGroup;
                    previousInlineGroup = undefined;
                    const currentBorrowed = borrowedSiblingRAngle;
                    borrowedSiblingRAngle = false;
                    const nextCanBorrow =
                        nextIsAdjacentInline &&
                        next?.kind === "nonText" &&
                        next.node.type === "Element" &&
                        next.node.closing !== null;

                    const element = this.#nonText(
                        node,
                        currentBorrowed,
                        nextCanBorrow || nextWordBorrows,
                    );

                    if (needsOuterGroup) {
                        const inner = Symbol("inner");
                        if (trailingLineInInner) {
                            parts.push(
                                group(
                                    [
                                        softLineOrSpace,
                                        group(
                                            [element, softLineOrSpace],
                                            inner,
                                        ),
                                    ],
                                    id,
                                ),
                            );
                            lastHadTrailingLine = true;
                        } else {
                            parts.push(
                                group(
                                    [
                                        softLineOrSpace,
                                        group(
                                            [element, separator("inside")],
                                            inner,
                                        ),
                                        separator("outside"),
                                    ],
                                    id,
                                ),
                            );
                            lastHadTrailingLine = false;
                        }
                    } else if (forceMultiline) {
                        if (conditional)
                            parts.push(
                                group([
                                    ifGroupFitsOnLine(softLine, conditional),
                                    group([element, separator("inside")], id),
                                    separator("outside"),
                                ]),
                            );
                        else
                            parts.push(
                                group([element, separator("inside")], id),
                                separator("outside"),
                            );
                        lastHadTrailingLine = false;
                    } else {
                        if (
                            !this.#internallySensitive(display) &&
                            willBreak(element)
                        )
                            forceMultiline = true;
                        if (conditional)
                            parts.push(
                                group([
                                    ifGroupFitsOnLine(softLine, conditional),
                                    group([element, separator("inside")], id),
                                    separator("outside"),
                                ]),
                            );
                        else
                            parts.push(
                                group([element, separator("inside")], id),
                                separator("outside"),
                            );
                        lastHadTrailingLine = false;
                    }

                    previousInlineGroup = nextIsAdjacentInline ? id : undefined;
                    // self-closing elements have no closing tag to lend its `>`
                    if ((nextCanBorrow || nextWordBorrows) && closesWithRAngle)
                        borrowedSiblingRAngle = true;
                    break;
                }
            }

            if (childBreaks) forceMultiline = true;
            last = child;
            first = false;
        }

        if (borrowedClosing) parts.push(this.#partialClosing(borrowedClosing));

        if (!parent) return parts;
        return softBlockIndent(parts);
    }

    static #isBr(node: NonText): boolean {
        return node.type === "Element" && node.name.toLowerCase() === "br";
    }

    static #isSelfClosingOrBr(node: NonText): boolean {
        return (
            (node.type === "Element" && node.closing === null) ||
            Html.#isBr(node)
        );
    }

    #nonText(
        node: NonText,
        borrowedRAngle: boolean,
        closingRAngleBorrowed: boolean,
    ): IR {
        if (node.type === "Cdata") return text(node.value);
        if (node.closing === null) return this.#selfClosing(node);
        return this.#element(node, borrowedRAngle, closingRAngleBorrowed);
    }

    #partialClosing(element: Tree.Element): IR {
        return [
            "</",
            this.#tagName(element, element.closing?.name ?? element.name),
        ];
    }

    // ---- elements ----

    #tagName(element: Tree.Element, name: string): string {
        return element.tag && canonicalTags.has(element.tag)
            ? element.tag
            : name;
    }

    #element(
        element: Tree.Element,
        borrowedSiblingRAngle: boolean,
        closingRAngleBorrowed: boolean,
    ): IR {
        const id = Symbol("element");
        return group(
            this.#elementInner(
                element,
                borrowedSiblingRAngle,
                closingRAngleBorrowed,
            ),
            id,
        );
    }

    #elementInner(
        element: Tree.Element,
        borrowedSiblingRAngle: boolean,
        closingRAngleBorrowed: boolean,
    ): IR {
        const tag = element.tag;
        const display = Html.#displayOf(element);
        const children = element.children;
        const forceBreakContent = this.#forceBreakContent(element, display);
        const internallySensitive = this.#internallySensitive(display);
        const isRootChild = this.#parents.get(element) === null;
        const isTemplate = tag === "template";
        const structural = STRUCTURAL_FALLBACK.has(tag ?? "");
        const preservesEdges = structural || (isRootChild && isTemplate);
        const verbatim =
            element.raw ||
            tag === "script" ||
            tag === "style" ||
            PRESERVES_CONTENT.has(tag ?? "");
        const script =
            tag === "script"
                ? this.#scriptLanguage(element)
                : tag === "style"
                  ? // like Biome, styles of any type are CSS
                    ("css" as const)
                  : undefined;
        const embedded =
            script !== undefined && this.#options.embed !== undefined;

        const closingStart = element.closing?.start ?? element.end;
        const gapStart = this.#split(
            element.openingEnd,
            children[0]?.start ?? closingStart,
        );
        const firstLeading = children[0] ? gapStart.leading : [];
        const leadingWhitespace =
            Html.#hasWhitespace(firstLeading) ||
            Html.#hasWhitespace(gapStart.trailing);
        const lastChild = children.at(-1);
        const gapEnd = this.#split(
            lastChild?.end ?? element.openingEnd,
            closingStart,
        );
        const trailingWhitespace =
            (lastChild !== undefined && Html.#hasWhitespace(gapEnd.trailing)) ||
            Html.#hasWhitespace(gapEnd.leading);
        const leadingNewline = Html.#hasNewline(firstLeading);

        const hasNonTextChild = children.some(
            (child) => child.type === "Element",
        );
        const hasTextChild = children.some(
            (child) => child.type === "Text" && child.value.trim() !== "",
        );
        const forcesBreakChildren =
            forceBreakContent ||
            (isRootChild && isTemplate) ||
            (leadingNewline && hasNonTextChild && !hasTextChild);

        const edgeSensitive = (child: Tree.Child | undefined) =>
            child === undefined ||
            this.#externallySensitive(
                child.type === "Text" ? "inline" : Html.#display(child),
            );
        const borrowOpening =
            internallySensitive &&
            children.length > 0 &&
            (!preservesEdges || edgeSensitive(children[0])) &&
            !leadingWhitespace &&
            !verbatim &&
            !embedded;
        const borrowClosing =
            internallySensitive &&
            children.length > 0 &&
            (!preservesEdges || edgeSensitive(lastChild)) &&
            !trailingWhitespace &&
            !verbatim &&
            !embedded;

        const attributesId = Symbol("element-attr-group-id");
        const parts: IR[] = [
            this.#opening(
                element,
                borrowOpening,
                attributesId,
                borrowedSiblingRAngle,
                internallySensitive,
                gapStart.trailing,
            ),
        ];

        if (embedded && script) {
            if (children.length > 0) {
                const code = (children[0] as Tree.Text).value;
                const formatter = this.#options.embed as NonNullable<
                    HtmlOptions["embed"]
                >;
                const start = (children[0] as Tree.Text).start;
                const content = embed((level) => {
                    try {
                        return formatter(code, script, level) ?? code;
                    } catch (error) {
                        // positions in the script are positions in the file
                        if (error instanceof ParseError)
                            throw new ParseError(
                                error.message,
                                error.position + start,
                            );
                        throw error;
                    }
                });
                parts.push(
                    this.#options.indentScriptAndStyle
                        ? [hardLine, indent([hardLine, content]), hardLine]
                        : [hardLine, content, hardLine],
                );
            }
        } else if (verbatim) {
            if (children.length > 0) {
                const start = (children[0] as Tree.Child).start;
                const end = (lastChild as Tree.Child).end;
                parts.push(
                    text(
                        this.#source.slice(start, end).replace(/\r\n?/g, "\n"),
                    ),
                );
            }
        } else if (children.length === 0) {
            parts.push(this.#dangling(element));
        } else {
            parts.push(
                this.#list(children, element, {
                    layout: forcesBreakChildren ? "multiline" : "bestFitting",
                    sensitive: internallySensitive,
                    borrowedRAngle: borrowOpening,
                    ...(borrowClosing && { borrowedClosing: element }),
                }),
            );
        }

        parts.push(
            this.#closing(
                element,
                borrowClosing,
                closingRAngleBorrowed,
                internallySensitive,
            ),
        );
        return parts;
    }

    /** The comments of an element without children. */
    #dangling(element: Tree.Element): IR {
        const end = element.closing?.start ?? element.end;
        const pieces = this.#pieces(element.openingEnd, end);
        if (!pieces.some((piece) => piece.comment)) return "";
        const newlineBeforeClosing = Html.#hasWhitespace(
            this.#split(element.openingEnd, end).leading,
        );
        const parts: IR[] = [];
        let newlines = 0;
        let index = 0;
        for (const piece of pieces) {
            if (!piece.comment) {
                newlines += (piece.text.match(/\n/g) ?? []).length;
                continue;
            }
            if (index > 0 && newlines > 0)
                parts.push(newlines > 1 ? emptyLine : hardLine);
            parts.push(text(piece.text));
            newlines = 0;
            index++;
        }
        return newlineBeforeClosing
            ? blockIndent(parts)
            : softBlockIndent(parts);
    }

    #forceBreakContent(element: Tree.Element, display: Display): boolean {
        if (this.#forceBreakChildren(element, display)) return true;
        if (element.children.length > 0 && element.tag === "body") return true;
        return element.children.some(
            (child) =>
                child.type === "Element" &&
                child.children.some(
                    (grandchild) => grandchild.type === "Element",
                ),
        );
    }

    #forceBreakChildren(element: Tree.Element, display: Display): boolean {
        if (FORCE_BREAK_CHILDREN.has(element.tag ?? "")) return true;
        return TABLE_LIKE.has(display) && display !== "table-cell";
    }

    #scriptLanguage(
        element: Tree.Element,
    ): "javascript" | "module" | "json" | undefined {
        const type = element.attributes.findLast(
            (attribute) => attribute.name.toLowerCase() === "type",
        );
        const value = type?.value?.text;
        if (type === undefined || value === undefined) return "javascript";
        const lower = value.toLowerCase();
        if (lower === "module") return "module";
        if (
            lower === "text/javascript" ||
            lower === "application/javascript" ||
            lower === "application/ecmascript"
        )
            return "javascript";
        if (lower === "importmap" || lower === "application/json")
            return "json";
        return undefined;
    }

    #opening(
        element: Tree.Element,
        rAngleBorrowed: boolean,
        id: symbol,
        borrowedSiblingRAngle: boolean,
        sensitive: boolean,
        trailing: Piece[],
    ): IR {
        const parts: IR[] = [];
        if (borrowedSiblingRAngle) parts.push(">");
        parts.push("<", this.#tagName(element, element.name));
        parts.push(this.#attributes(element.attributes, element));
        if (!this.#options.bracketSameLine) parts.push(softLine);
        if (!rAngleBorrowed) parts.push(">");
        const result: IR[] = [group(parts, id)];
        if (sensitive && Html.#hasWhitespace(trailing)) result.push(space);
        return result;
    }

    #closing(
        element: Tree.Element,
        tagBorrowed: boolean,
        rAngleBorrowed: boolean,
        sensitive: boolean,
    ): IR {
        const closing = element.closing as Tree.ClosingTag;
        const parts: IR[] = [];
        if (!tagBorrowed) {
            const lastEnd = element.children.at(-1)?.end ?? element.openingEnd;
            const { leading } = this.#split(lastEnd, closing.start);
            if (sensitive && Html.#hasWhitespace(leading)) parts.push(space);
            parts.push("</", this.#tagName(element, closing.name));
        }
        if (!rAngleBorrowed) parts.push(">");
        return parts;
    }

    #selfClosing(element: Tree.Element): IR {
        const voidElement = Html.#isVoid(element);
        const always = this.#options.selfCloseVoidElements === "always";
        const parts: IR[] = [this.#attributes(element.attributes, element)];
        if (this.#options.bracketSameLine) {
            const slash =
                always || (element.selfClosing && !(voidElement && !always));
            // Biome prints a hard space like a pending space
            if (slash) parts.push(space);
        } else if (element.attributes.length >= 1)
            parts.push(always ? softLineOrSpace : softLine);
        else if (always) parts.push(softLineOrSpace);
        if (always) parts.push(ifGroupFitsOnLine(space), "/");
        else if (voidElement) {
            // never self-closes void elements
        } else {
            if (element.selfClosing) parts.push(space);
            if (element.selfClosing) parts.push("/");
        }
        parts.push(">");
        return [
            "<",
            this.#tagName(element, element.name),
            group(parts, Symbol("element-attr-group-id")),
        ];
    }

    static #isVoid(element: Tree.Element): boolean {
        return /^(?:area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/.test(
            element.tag ?? "",
        );
    }

    // ---- attributes ----

    #attributes(
        attributes: Tree.Attribute[],
        element: Tree.Element | null,
        singleLine = false,
    ): IR {
        if (attributes.length === 0) return "";
        const multiline =
            this.#options.attributePosition === "multiline" &&
            attributes.length > 1;
        const separator = singleLine
            ? space
            : multiline
              ? hardLine
              : softLineOrSpace;
        const printed: IR[] = [];
        for (const [index, attribute] of attributes.entries()) {
            if (index > 0) printed.push(separator);
            printed.push(this.#attribute(attribute, element));
        }
        return singleLine
            ? [space, printed]
            : [space, softLineIndentOrSpace(printed)];
    }

    #attribute(attribute: Tree.Attribute, element: Tree.Element | null): IR {
        const canonical =
            element?.tag !== null &&
            element?.tag !== undefined &&
            canonicalTags.has(element.tag) &&
            Html.#canonicalAttribute(element.name, attribute.name);
        const name = canonical ? attribute.name.toLowerCase() : attribute.name;
        const value = attribute.value;
        if (!value) return name;
        const tag = element?.name;
        const attributeName = attribute.name;
        if (tag === "iframe" && attributeName === "allow") {
            const items = value.text
                .split(";")
                .map((item) => item.trim())
                .filter((item) => item !== "");
            const joined: IR[] = [];
            for (const [index, item] of items.entries()) {
                if (index > 0) joined.push(";", softLineOrSpace);
                joined.push(item);
            }
            joined.push(ifGroupBreaks(";"));
            return [name, "=", '"', group(softBlockIndent(joined)), '"'];
        }
        if ((tag === "img" || tag === "source") && attributeName === "srcset") {
            const candidates = srcset(value.text);
            if (candidates)
                return [
                    name,
                    "=",
                    '"',
                    group(softBlockIndent(candidates)),
                    '"',
                ];
        }
        return [name, "=", Html.#string(value.raw)];
    }

    static #canonicalAttribute(tag: string, attribute: string): boolean {
        const name = attribute.toLowerCase();
        if (globalAttributes.has(name)) return true;
        return attributesByTag[tag.toLowerCase()]?.includes(name) ?? false;
    }

    /** An attribute value with Biome's quotes. */
    static #string(raw: string): IR {
        if (raw.startsWith("`")) return raw;
        const requoted = Html.#requote(raw);
        if (requoted !== undefined) return text(requoted);
        if (!Html.#quoted(raw)) return group(['"', text(raw), '"']);
        return text(raw);
    }

    static #quoted(value: string): boolean {
        if (value.length < 2) return false;
        const first = value[0];
        const last = value.at(-1);
        return (
            (first === '"' && last === '"') || (first === "'" && last === "'")
        );
    }

    static #requote(value: string): string | undefined {
        const inner = Html.#quoted(value) ? value.slice(1, -1) : value;
        let doubles = 0;
        let singles = 0;
        let literalDoubles = 0;
        let literalSingles = 0;
        let escapedDoubles = 0;
        let escapedSingles = 0;
        for (let index = 0; index < inner.length; index++) {
            const char = inner[index];
            if (char === '"') {
                doubles++;
                literalDoubles++;
            } else if (char === "'") {
                singles++;
                literalSingles++;
            } else if (inner.startsWith("&quot;", index)) {
                doubles++;
                escapedDoubles++;
                index += 5;
            } else if (inner.startsWith("&apos;", index)) {
                singles++;
                escapedSingles++;
                index += 5;
            }
        }
        const [delimiter, escaped, unescaped, literal, escapedOther] =
            doubles > singles
                ? ([
                      "'",
                      "&apos;",
                      "&quot;",
                      literalSingles,
                      escapedDoubles,
                  ] as const)
                : ([
                      '"',
                      "&quot;",
                      "&apos;",
                      literalDoubles,
                      escapedSingles,
                  ] as const);
        if (
            value.startsWith(delimiter) &&
            value.endsWith(delimiter) &&
            value.length >= 2 &&
            literal === 0 &&
            escapedOther === 0
        )
            return undefined;
        let result = delimiter;
        for (let index = 0; index < inner.length; ) {
            if (inner[index] === delimiter) {
                result += escaped;
                index++;
            } else if (inner.startsWith(unescaped, index)) {
                result += delimiter === '"' ? "'" : '"';
                index += unescaped.length;
            } else {
                result += inner[index];
                index++;
            }
        }
        return result + delimiter;
    }
}
