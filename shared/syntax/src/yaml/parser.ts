import { ParseError } from "../scanner.js";
import type {
    Alias,
    BlockScalar,
    Comment,
    CommentLine,
    Document,
    FlowItem,
    FlowMapping,
    FlowSequence,
    Mapping,
    MappingEntry,
    Node,
    Prelude,
    Scalar,
    Sequence,
    SequenceItem,
    Stream,
} from "./ast.js";

/** A blank line, or a line with only a comment. */
interface GapLine {
    /** Where the line after it starts. */
    next: number;
    /** The column of its comment. */
    column: number;
    comment?: Comment;
}

/** The blank and comment lines before a line with content. */
interface Gap {
    lines: GapLine[];
    /** Where the line with content starts, the end of the source without one. */
    start: number;
    /** Its indentation, -1 at the end and at a document marker. */
    column: number;
}

/** The context of a node: a block one can be a compact collection, a mapping value not. */
type Context = "block" | "value";

const flowIndicators = ",[]{}";

/**
 * Parses YAML, with line feeds as line endings, into documents of block
 * and flow nodes, keeping comments and blank lines where they are.
 */
export default class YamlParser {
    position = 0;
    readonly #source: string;

    constructor(source: string) {
        this.#source = source;
    }

    parse(): Stream {
        const documents: Document[] = [];
        for (;;) {
            // a document starts without `---` first and after `...`
            const previous = documents.at(-1);
            const document = this.#document(
                previous === undefined || previous.explicitEnd,
            );
            if (!document) break;
            documents.push(document);
        }
        return { type: "Stream", documents };
    }

    #document(bare: boolean): Document | undefined {
        const source = this.#source;
        const start = this.position;
        const prelude: Prelude[] = [];
        let blank = false;
        for (;;) {
            const gap = this.#gap();
            for (const line of gap.lines) {
                if (!line.comment) blank = prelude.length > 0;
                else {
                    prelude.push({ text: line.comment.value, blank });
                    blank = false;
                }
            }
            this.position = gap.start;
            if (gap.column !== 0 || source[gap.start] !== "%") break;
            const end = this.#lineEnd(gap.start);
            prelude.push({
                text: source.slice(gap.start, end).trimEnd(),
                blank,
            });
            blank = false;
            this.position = end;
            this.#nextLine();
        }

        const document: Document = {
            type: "Document",
            start,
            end: start,
            prelude,
            explicitStart: false,
            startBlank: false,
            leading: [],
            blank: false,
            root: null,
            trailing: [],
            explicitEnd: false,
        };
        if (this.position >= source.length) {
            if (prelude.length === 0) return undefined;
            document.end = this.position;
            return document;
        }

        if (this.#marker(this.position, "---")) {
            document.explicitStart = true;
            document.startBlank = blank;
            this.position += 3;
            this.#spaces();
            if (source[this.position] === "#") {
                const comment = this.#rest();
                if (comment) document.startComment = comment;
            } else if (this.#lineEnded()) this.#nextLine();
            else {
                document.root = this.#node(-1, "block");
                this.#finish(document.root);
            }
        } else if (!bare && !this.#marker(this.position, "..."))
            throw new ParseError(
                "Expected `---` before another document.",
                this.position,
            );

        if (!document.root) {
            const value = this.#blockValue(-1, false);
            document.root = value.node;
            document.leading = value.leading;
            // without `---`, a blank line after the prelude comes before the node
            document.blank =
                value.leading.length > 0 || document.explicitStart
                    ? value.blank
                    : blank;
        }

        const gap = this.#gap();
        let trailingBlank = false;
        for (const line of gap.lines)
            if (!line.comment) trailingBlank = true;
            else {
                document.trailing.push({
                    comment: line.comment,
                    blank: trailingBlank,
                });
                trailingBlank = false;
            }
        this.position = gap.start;
        if (gap.column >= 0)
            throw new ParseError(
                "Unexpected content, it is not part of the document.",
                gap.start + gap.column,
            );
        if (this.#marker(this.position, "...")) {
            document.explicitEnd = true;
            this.position += 3;
            const comment = this.#rest();
            if (comment) document.endComment = comment;
        }
        document.end = this.position;
        return document;
    }

    /**
     * The node on the lines after an indicator, indented deeper than `n`,
     * or a sequence at `n` after a mapping key; null when there is none.
     */
    #blockValue(
        n: number,
        sequence: boolean,
    ): { node: Node | null; leading: CommentLine[]; blank: boolean } {
        const gap = this.#gap();
        const content = gap.start + gap.column;
        if (
            !(
                gap.column > n ||
                (sequence &&
                    n >= 0 &&
                    gap.column === n &&
                    this.#indicator(content, "-"))
            )
        )
            return { node: null, leading: [], blank: false };

        const leading: CommentLine[] = [];
        let blank = false;
        for (const line of gap.lines)
            if (!line.comment) blank = true;
            else {
                leading.push({ comment: line.comment, blank });
                blank = false;
            }
        this.position = content;
        const node = this.#node(n, "block");
        this.#finish(node);
        return { node, leading, blank };
    }

    /**
     * A node at the position, belonging to a node indented by `n`. Single
     * line nodes leave the position after them, others at the start of the
     * line after them.
     */
    #node(n: number, context: Context): Node {
        const source = this.#source;
        const start = this.position;
        const column = this.#column(start);
        const properties = this.#properties(false);

        if (
            properties !== undefined &&
            (this.#lineEnded() || source[this.position] === "#")
        ) {
            // properties alone, of the node on the lines after them
            const comment = this.#rest();
            const value = this.#blockValue(n, context === "value");
            const node: Node = value.node ?? {
                type: "Scalar",
                style: "plain",
                lines: [],
                start,
                end: start + properties.length,
            };
            node.properties = properties;
            if (comment) node.propertiesComment = comment;
            if (value.leading.length > 0) node.leading = value.leading;
            node.start = start;
            return node;
        }

        const char = source[this.position];
        if (char === "-" && this.#separated(this.position + 1)) {
            if (context === "value")
                throw new ParseError(
                    "A sequence cannot start on the line of a mapping key.",
                    this.position,
                );
            return this.#sequence(
                this.#column(this.position),
                properties,
                start,
            );
        }
        if (char === "?" && this.#separated(this.position + 1)) {
            if (context === "value")
                throw new ParseError(
                    "A mapping cannot start on the line of a mapping key.",
                    this.position,
                );
            const mapping = this.#mapping(column, undefined, start);
            if (properties) mapping.properties = properties;
            return mapping;
        }
        if (char === "|" || char === ">") {
            const scalar = this.#blockScalar(n);
            if (properties) {
                scalar.properties = properties;
                scalar.start = start;
            }
            return scalar;
        }

        if (properties !== undefined && char === "*")
            throw new ParseError(
                "An alias cannot have a tag or an anchor.",
                this.position,
            );
        const node = this.#inline(n);
        if (properties) {
            node.properties = properties;
            node.start = start;
        }
        const end = this.position;
        this.#spaces();
        if (
            source[this.position] === ":" &&
            this.#separated(this.position + 1)
        ) {
            if (context === "value")
                throw new ParseError(
                    "A mapping cannot start on the line of a mapping key.",
                    this.position,
                );
            if (source.slice(start, end).includes("\n"))
                throw new ParseError(
                    "A mapping key must be on a single line.",
                    start,
                );
            return this.#mapping(column, node, start);
        }
        this.position = end;
        return node;
    }

    /** A scalar, alias or flow collection on a line, maybe a mapping key. */
    #inline(n: number): Node {
        const char = this.#source[this.position];
        if (char === "[" || char === "{") return this.#flow();
        if (char === '"' || char === "'") return this.#quoted();
        if (char === "*") return this.#alias(false);
        if (char !== undefined && ",]}%@`".includes(char))
            throw new ParseError(
                `A plain scalar cannot start with \`${char}\`.`,
                this.position,
            );
        return this.#plain(n);
    }

    #mapping(column: number, first: Node | undefined, start: number): Mapping {
        const mapping: Mapping = {
            type: "Mapping",
            entries: [],
            endComments: [],
            start,
            end: start,
        };
        let key = first;
        let leading: CommentLine[] = [];
        let blank = false;
        for (;;) {
            const entry = this.#entry(column, key);
            entry.leading = leading;
            entry.blank = blank;
            mapping.entries.push(entry);
            key = undefined;
            const after = this.#after(
                column,
                entry,
                (content) => !this.#indicator(content, "-"),
            );
            if (!after.more) {
                mapping.endComments = after.comments;
                break;
            }
            leading = after.comments;
            blank = after.blank;
        }
        mapping.end = this.position;
        return mapping;
    }

    /** An entry of a block mapping, after its key when it is known. */
    #entry(column: number, first: Node | undefined): MappingEntry {
        const source = this.#source;
        const entry: MappingEntry = {
            key: null,
            explicit: false,
            keyBetween: [],
            value: null,
            leading: [],
            blank: false,
            between: [],
            betweenBlank: false,
            inner: [],
        };

        if (!first && this.#indicator(this.position, "?")) {
            entry.explicit = true;
            this.position++;
            this.#spaces();
            if (this.#lineEnded() || source[this.position] === "#") {
                const comment = this.#rest();
                if (comment) entry.keyComment = comment;
                const value = this.#blockValue(column, true);
                entry.key = value.node;
                entry.keyBetween = value.leading;
            } else {
                entry.key = this.#node(column, "block");
                this.#finish(entry.key);
            }
            const gap = this.#gap();
            if (
                gap.column === column &&
                this.#indicator(gap.start + column, ":")
            ) {
                for (const line of gap.lines)
                    if (line.comment)
                        entry.keyBetween.push({
                            comment: line.comment,
                            blank: false,
                        });
                this.position = gap.start + column + 1;
                this.#value(entry, column, "block");
            }
            return entry;
        }

        let key = first;
        if (!key) {
            const start = this.position;
            const properties = this.#properties(false);
            if (properties !== undefined && source[this.position] === "*")
                throw new ParseError(
                    "An alias cannot have a tag or an anchor.",
                    this.position,
                );
            key = this.#inline(column);
            if (properties) {
                key.properties = properties;
                key.start = start;
            }
            if (source.slice(start, this.position).includes("\n"))
                throw new ParseError(
                    "A mapping key must be on a single line.",
                    start,
                );
            this.#spaces();
            if (
                !(
                    source[this.position] === ":" &&
                    this.#separated(this.position + 1)
                )
            )
                throw new ParseError(
                    "Expected a mapping entry, a key and `:`.",
                    start,
                );
        }
        entry.key = key;
        this.position++;
        this.#value(entry, column, "value");
        return entry;
    }

    /** The value of a mapping entry, after its `:`. */
    #value(entry: MappingEntry, column: number, context: Context): void {
        this.#spaces();
        if (this.#lineEnded() || this.#source[this.position] === "#") {
            const comment = this.#rest();
            if (comment) entry.comment = comment;
            const value = this.#blockValue(column, true);
            entry.value = value.node;
            entry.between = value.leading;
            entry.betweenBlank = value.blank;
            return;
        }
        entry.value = this.#node(column, context);
        this.#finish(entry.value);
    }

    #sequence(
        column: number,
        properties: string | undefined,
        start: number,
    ): Sequence {
        const source = this.#source;
        const sequence: Sequence = {
            type: "Sequence",
            items: [],
            endComments: [],
            start,
            end: start,
        };
        if (properties) sequence.properties = properties;
        let leading: CommentLine[] = [];
        let blank = false;
        for (;;) {
            const item: SequenceItem = {
                value: null,
                leading,
                blank,
                between: [],
                betweenBlank: false,
                inner: [],
            };
            this.position++;
            this.#spaces();
            if (this.#lineEnded() || source[this.position] === "#") {
                const comment = this.#rest();
                if (comment) item.comment = comment;
                const value = this.#blockValue(column, false);
                item.value = value.node;
                item.between = value.leading;
                item.betweenBlank = value.blank;
            } else {
                item.value = this.#node(column, "block");
                this.#finish(item.value);
            }
            sequence.items.push(item);
            const after = this.#after(column, item, (content) =>
                this.#indicator(content, "-"),
            );
            if (!after.more) {
                sequence.endComments = after.comments;
                break;
            }
            leading = after.comments;
            blank = after.blank;
        }
        sequence.end = this.position;
        return sequence;
    }

    /**
     * Takes the blank and comment lines after an entry of a collection at a
     * column. Comments deeper than the entry go into it, unless its value is
     * a block scalar they could be taken for, other comments at least as deep as the collection
     * stay in it, before its next entry or at its end, as do ones before its
     * next entry. Once a comment is at the collection's level, the ones
     * after it are too. The rest is left to the collections around it.
     */
    #after(
        column: number,
        entry: SequenceItem,
        continues: (content: number) => boolean,
    ): { more: boolean; comments: CommentLine[]; blank: boolean } {
        const gap = this.#gap();
        const next = gap.column;
        if (next > column)
            throw new ParseError(
                "Unexpected indentation.",
                gap.start + gap.column,
            );
        const more = next === column && continues(gap.start + column);
        const scalar = entry.value?.type === "BlockScalar";
        const comments: CommentLine[] = [];
        let level = false;
        let blank = false;
        let position = this.position;
        for (const line of gap.lines) {
            if (!line.comment) {
                blank = true;
                continue;
            }
            const item = { comment: line.comment, blank };
            if (line.column > next) {
                if (line.column < column) break;
                if (line.column > column && !level && !scalar)
                    entry.inner.push(item);
                else {
                    level = true;
                    comments.push(item);
                }
            } else if (more) {
                level = true;
                comments.push(item);
            } else break;
            blank = false;
            position = line.next;
        }
        if (more) {
            this.position = gap.start + column;
            return { more, comments, blank };
        }
        this.position = position;
        return { more, comments, blank: false };
    }

    /** A plain scalar in a block, which continues on lines indented deeper than `n`. */
    #plain(n: number): Scalar {
        const source = this.#source;
        const start = this.position;
        const char = source[start];
        if (
            char !== undefined &&
            "-?:".includes(char) &&
            this.#separated(start + 1)
        )
            throw new ParseError(`Unexpected \`${char}\`.`, start);

        const first = this.#plainLine(start);
        const lines = [source.slice(start, first.end)];
        let end = first.end;
        let stop = first.stop;
        while (stop === "\n") {
            let line = this.#lineEnd(end) + 1;
            let blanks = 0;
            let continued = false;
            while (line < source.length) {
                let index = line;
                while (source[index] === " ") index++;
                const indentation = index - line;
                while (source[index] === " " || source[index] === "\t") index++;
                const next = source[index];
                if (next === undefined || next === "\n") {
                    blanks++;
                    line = this.#lineEnd(line) + 1;
                    continue;
                }
                if (
                    next === "#" ||
                    indentation <= n ||
                    (indentation === 0 &&
                        (this.#marker(line, "---") ||
                            this.#marker(line, "...")))
                )
                    break;
                const scanned = this.#plainLine(index);
                if (scanned.stop === ":")
                    throw new ParseError(
                        "A mapping cannot start inside a multi-line scalar.",
                        index,
                    );
                lines.push(
                    ...Array.from({ length: blanks }, () => ""),
                    source.slice(index, scanned.end),
                );
                end = scanned.end;
                stop = scanned.stop;
                continued = true;
                break;
            }
            if (!continued) break;
        }
        this.position = end;
        return { type: "Scalar", style: "plain", lines, start, end };
    }

    /** Where the text of a plain scalar ends on a line, and what stops it there. */
    #plainLine(from: number): { end: number; stop: string } {
        const source = this.#source;
        let index = from;
        let end = from;
        for (;;) {
            const char = source[index];
            if (char === undefined || char === "\n") return { end, stop: "\n" };
            if (char === ":" && this.#separated(index + 1))
                return { end, stop: ":" };
            if (
                char === "#" &&
                (source[index - 1] === " " || source[index - 1] === "\t")
            )
                return { end, stop: "#" };
            index++;
            if (char !== " " && char !== "\t") end = index;
        }
    }

    #quoted(): Scalar {
        const source = this.#source;
        const start = this.position;
        const quote = source[start] as string;
        let index = start + 1;
        for (;;) {
            const char = source[index];
            if (char === undefined)
                throw new ParseError(
                    "Unterminated string, the closing quote is missing.",
                    start,
                );
            if (quote === '"' && char === "\\") index += 2;
            else if (char === quote) {
                if (quote === "'" && source[index + 1] === "'") index += 2;
                else break;
            } else index++;
        }
        const end = index + 1;
        this.position = end;
        const raw = source.slice(start, end).split("\n");
        const lines = raw.map((line, index) => {
            let text = index > 0 ? line.replace(/^[ \t]+/, "") : line;
            if (index < raw.length - 1) {
                const trimmed = text.replace(/[ \t]+$/, "");
                // an escaped space or tab stays
                text =
                    quote === '"' &&
                    trimmed.length < text.length &&
                    /(?:^|[^\\])(?:\\\\)*\\$/.test(trimmed)
                        ? text.slice(0, trimmed.length + 1)
                        : trimmed;
            }
            return text;
        });
        return {
            type: "Scalar",
            style: quote === "'" ? "single" : "double",
            lines,
            start,
            end,
        };
    }

    #alias(flow: boolean): Alias {
        const source = this.#source;
        const start = this.position;
        let index = start + 1;
        while (
            index < source.length &&
            !" \t\n".includes(source[index] as string) &&
            !(flow && flowIndicators.includes(source[index] as string))
        )
            index++;
        this.position = index;
        return {
            type: "Alias",
            name: source.slice(start, index),
            start,
            end: index,
        };
    }

    /** The tag and anchor at the position, the tag first, separated by a single space. */
    #properties(flow: boolean): string | undefined {
        const source = this.#source;
        const tags: string[] = [];
        const anchors: string[] = [];
        for (;;) {
            const start = this.position;
            const char = source[start];
            if (char !== "&" && char !== "!") break;
            let index = start + 1;
            if (char === "!" && source[index] === "<") {
                const close = source.indexOf(">", index);
                if (close < 0 || close > this.#lineEnd(start))
                    throw new ParseError("Unterminated verbatim tag.", start);
                index = close + 1;
            } else
                while (
                    index < source.length &&
                    !" \t\n".includes(source[index] as string) &&
                    !(flow && flowIndicators.includes(source[index] as string))
                )
                    index++;
            (char === "!" ? tags : anchors).push(source.slice(start, index));
            this.position = index;
            this.#spaces();
        }
        const parts = [...tags, ...anchors];
        return parts.length > 0 ? parts.join(" ") : undefined;
    }

    /**
     * A literal or folded scalar. Its content is indented deeper than `n`,
     * by the indentation indicator or as its first line. Trailing blank lines
     * are its own only when it keeps them, with `+`.
     */
    #blockScalar(n: number): BlockScalar {
        const source = this.#source;
        const start = this.position;
        let index = start + 1;
        let indicator = 0;
        while (index < start + 3 && /[1-9+-]/.test(source[index] ?? "")) {
            const char = source[index] as string;
            if (/\d/.test(char)) indicator = Number(char);
            index++;
        }
        const header = source.slice(start, index);
        this.position = index;
        if (!this.#separated(index))
            throw new ParseError("Invalid block scalar header.", index);
        const scalar: BlockScalar = {
            type: "BlockScalar",
            header,
            indicator,
            parent: n,
            indentation: 0,
            lines: [],
            start,
            end: index,
        };
        const comment = this.#rest();
        if (comment) scalar.comment = comment;

        let indentation = indicator > 0 ? Math.max(n + indicator, 0) : -1;
        const lines: string[] = [];
        let pending: string[] = [];
        let pendingStart = this.position;
        let line = this.position;
        while (line < source.length) {
            const end = this.#lineEnd(line);
            const text = source.slice(line, end);
            const next = end < source.length ? end + 1 : end;
            if (/^[ \t]*$/.test(text)) {
                if (pending.length === 0) pendingStart = line;
                pending.push(text);
                line = next;
                continue;
            }
            const spaces = /^ */.exec(text)?.[0].length ?? 0;
            if (indentation < 0) {
                if (spaces <= n) break;
                indentation = spaces;
            }
            if (
                spaces < indentation ||
                (spaces === 0 &&
                    (this.#marker(line, "---") || this.#marker(line, "...")))
            )
                break;
            lines.push(...pending, text);
            pending = [];
            line = next;
        }
        if (header.includes("+")) {
            lines.push(...pending);
            this.position = line;
        } else this.position = pending.length > 0 ? pendingStart : line;
        scalar.indentation = indentation < 0 ? n + 1 : indentation;
        scalar.lines = lines;
        scalar.end = this.position;
        return scalar;
    }

    #flow(): FlowMapping | FlowSequence {
        const source = this.#source;
        const start = this.position;
        const mapping = source[start] === "{";
        const close = mapping ? "}" : "]";
        this.position++;
        const items: FlowItem[] = [];
        const opening: Comment[] = [];
        for (;;) {
            (items.at(-1)?.comments ?? opening).push(...this.#flowSpace());
            const char = source[this.position];
            if (char === undefined)
                throw new ParseError(
                    `Unterminated flow collection, \`${close}\` is missing.`,
                    start,
                );
            if (char === close) {
                this.position++;
                break;
            }
            const item = this.#flowItem(close);
            items.push(item);
            item.comments.push(...this.#flowSpace());
            const after = source[this.position];
            if (after === undefined)
                throw new ParseError(
                    `Unterminated flow collection, \`${close}\` is missing.`,
                    start,
                );
            if (after === ",") this.position++;
            else if (after === close) {
                this.position++;
                break;
            } else
                throw new ParseError(
                    `Expected \`,\` or \`${close}\`.`,
                    this.position,
                );
        }
        return {
            type: mapping ? "FlowMapping" : "FlowSequence",
            items,
            opening,
            start,
            end: this.position,
        };
    }

    /** A pair or a single node of a flow collection, a single node is its key. */
    #flowItem(close: string): FlowItem {
        const source = this.#source;
        const comments: Comment[] = [];
        if (this.#indicator(this.position, "?")) {
            this.position++;
            comments.push(...this.#flowSpace());
        }
        const empty =
            source[this.position] === ":" &&
            this.#flowSeparated(this.position + 1);
        const key = empty ? null : this.#flowNode(close);
        comments.push(...this.#flowSpace());
        if (source[this.position] !== ":")
            return { key, value: null, pair: false, comments };
        this.position++;
        comments.push(...this.#flowSpace());
        const next = source[this.position];
        const value =
            next === "," || next === close ? null : this.#flowNode(close);
        return { key, value, pair: true, comments };
    }

    #flowNode(close: string): Node {
        const source = this.#source;
        const start = this.position;
        const properties = this.#properties(true);
        const char = source[this.position];
        let node: Node;
        if (
            properties !== undefined &&
            (char === "," ||
                char === close ||
                (char === ":" && this.#flowSeparated(this.position + 1)))
        )
            node = {
                type: "Scalar",
                style: "plain",
                lines: [],
                start,
                end: this.position,
            };
        else if (char === "[" || char === "{") node = this.#flow();
        else if (char === '"' || char === "'") node = this.#quoted();
        else if (char === "*") {
            if (properties !== undefined)
                throw new ParseError(
                    "An alias cannot have a tag or an anchor.",
                    this.position,
                );
            node = this.#alias(true);
        } else if (char === undefined || "]}#".includes(char))
            throw new ParseError(
                `Unexpected \`${char ?? "end"}\` in a flow collection.`,
                this.position,
            );
        else node = this.#flowPlain();
        if (properties) {
            node.properties = properties;
            node.start = start;
        }
        return node;
    }

    /** A plain scalar in a flow collection, which may continue on the lines after it. */
    #flowPlain(): Scalar {
        const source = this.#source;
        const start = this.position;
        let index = start;
        for (;;) {
            const char = source[index];
            if (
                char === undefined ||
                flowIndicators.includes(char) ||
                (char === ":" && this.#flowSeparated(index + 1)) ||
                (char === "#" && " \t\n".includes(source[index - 1] ?? ""))
            )
                break;
            index++;
        }
        const raw = source.slice(start, index).replace(/\s+$/, "");
        this.position = start + raw.length;
        const lines = raw
            .split("\n")
            .map((line, index) => (index === 0 ? line.trimEnd() : line.trim()));
        return {
            type: "Scalar",
            style: "plain",
            lines,
            start,
            end: this.position,
        };
    }

    /** Skips whitespace and line breaks in a flow collection, returning its comments. */
    #flowSpace(): Comment[] {
        const source = this.#source;
        const comments: Comment[] = [];
        for (;;) {
            const char = source[this.position];
            if (char === " " || char === "\t" || char === "\n") this.position++;
            else if (char === "#") comments.push(this.#comment());
            else return comments;
        }
    }

    /** Reads the comment at the position, up to the end of its line. */
    #comment(): Comment {
        const start = this.position;
        const end = this.#lineEnd(start);
        this.position = end;
        return {
            start,
            end,
            value: this.#source.slice(start, end).trimEnd(),
        };
    }

    /** Finishes a single line node with the rest of its line. */
    #finish(node: Node): void {
        if (this.#atLineStart()) return;
        const comment = this.#rest();
        if (comment) node.comment = comment;
    }

    /** The rest of a line, only spaces and a comment, then moves to the next line. */
    #rest(): Comment | undefined {
        this.#spaces();
        let comment: Comment | undefined;
        if (this.#source[this.position] === "#") comment = this.#comment();
        if (!this.#lineEnded())
            throw new ParseError(
                "Unexpected content after a node.",
                this.position,
            );
        this.#nextLine();
        return comment;
    }

    /** The blank and comment lines from the line at the position to the next line with content. */
    #gap(): Gap {
        const source = this.#source;
        const lines: GapLine[] = [];
        let start = this.position;
        while (start < source.length) {
            let index = start;
            while (source[index] === " ") index++;
            const indentation = index - start;
            while (source[index] === " " || source[index] === "\t") index++;
            const char = source[index];
            const end = this.#lineEnd(start);
            const next = end < source.length ? end + 1 : end;
            if (char === undefined || char === "\n") {
                lines.push({ next, column: -1 });
                start = next;
                continue;
            }
            if (char === "#") {
                lines.push({
                    next,
                    column: index - start,
                    comment: {
                        start: index,
                        end,
                        value: source.slice(index, end).trimEnd(),
                    },
                });
                start = next;
                continue;
            }
            if (index !== start + indentation)
                throw new ParseError(
                    "Tabs are not allowed for indentation in YAML.",
                    start + indentation,
                );
            const marker =
                indentation === 0 &&
                (this.#marker(start, "---") || this.#marker(start, "..."));
            return { lines, start, column: marker ? -1 : indentation };
        }
        return { lines, start: source.length, column: -1 };
    }

    /** Whether a document marker, `---` or `...`, starts a line at a position. */
    #marker(position: number, marker: "---" | "..."): boolean {
        return (
            this.#source.startsWith(marker, position) &&
            this.#separated(position + 3)
        );
    }

    /** Whether an indicator like `-` or `?` is at a position, followed by a space or a line end. */
    #indicator(position: number, char: string): boolean {
        return this.#source[position] === char && this.#separated(position + 1);
    }

    #separated(position: number): boolean {
        const char = this.#source[position];
        return (
            char === undefined || char === " " || char === "\t" || char === "\n"
        );
    }

    /** Whether a `:` before a position separates a key in a flow collection. */
    #flowSeparated(position: number): boolean {
        return (
            this.#separated(position) ||
            flowIndicators.includes(this.#source[position] as string)
        );
    }

    #spaces(): void {
        while (
            this.#source[this.position] === " " ||
            this.#source[this.position] === "\t"
        )
            this.position++;
    }

    #lineEnded(): boolean {
        return (
            this.position >= this.#source.length ||
            this.#source[this.position] === "\n"
        );
    }

    #atLineStart(): boolean {
        return (
            this.position >= this.#source.length ||
            this.position === 0 ||
            this.#source[this.position - 1] === "\n"
        );
    }

    #nextLine(): void {
        const end = this.#lineEnd(this.position);
        this.position = end < this.#source.length ? end + 1 : end;
    }

    #lineEnd(position: number): number {
        const end = this.#source.indexOf("\n", position);
        return end < 0 ? this.#source.length : end;
    }

    #column(position: number): number {
        return position - (this.#source.lastIndexOf("\n", position - 1) + 1);
    }
}
