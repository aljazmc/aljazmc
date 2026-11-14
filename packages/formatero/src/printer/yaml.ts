import { parseYaml, type Yaml as Y } from "@aljazmc/syntax";
import {
    align,
    breakParent,
    type Doc,
    dedent,
    group,
    hardline,
    ifBreak,
    indent,
    join,
    line,
    lineSuffix,
    removeLines,
    softline,
} from "./doc.js";
import Layout from "./layout.js";

export interface YamlOptions {
    lineWidth: number;
    indentWidth: number;
    /** The preferred quote of quoted scalars. */
    quote: '"' | "'";
    /** Spaces inside flow mappings and sequences that fit on a line. */
    bracketSpacing: { mapping: boolean; sequence: boolean };
}

type Collection = Y.Mapping | Y.Sequence;
type Flow = Y.FlowMapping | Y.FlowSequence;

/** What a sequence item, an explicit key and its value share. */
interface Item {
    value: Y.Node | null;
    comment?: Y.Comment | undefined;
    between: Y.CommentLine[];
    betweenBlank: boolean;
    inner: Y.CommentLine[];
}

/**
 * Formats YAML like Biome: by its structure, with collections indented,
 * single spaces after indicators and before comments, the preferred quotes
 * and flow collections broken when they do not fit. Scalars keep their
 * values, block scalars their content.
 */
export default class Yaml {
    readonly #options: YamlOptions;

    constructor(options: YamlOptions) {
        this.#options = options;
    }

    /** Formats YAML with line feeds as line endings. */
    format(source: string): string {
        const stream = parseYaml(source);
        const documents = stream.documents.map((document) =>
            this.#document(document),
        );
        return new Layout({
            lineWidth: this.#options.lineWidth,
            indentWidth: this.#options.indentWidth,
            // YAML is indented with spaces only
            useTabs: false,
        }).print(join(hardline, documents));
    }

    #document(document: Y.Document): Doc {
        const lines: { doc: Doc; blank: boolean }[] = document.prelude.map(
            ({ text, blank }) => ({ doc: text, blank }),
        );
        if (document.explicitStart)
            lines.push({
                doc: ["---", Yaml.#after(document.startComment)],
                blank: document.startBlank,
            });
        for (const { comment, blank } of document.leading)
            lines.push({ doc: comment.value, blank });
        if (document.root)
            lines.push({
                doc: this.#root(document.root),
                blank: document.blank,
            });
        for (const { comment, blank } of document.trailing)
            lines.push({ doc: comment.value, blank });
        if (document.explicitEnd)
            lines.push({
                doc: ["...", Yaml.#after(document.endComment)],
                blank: false,
            });
        return Yaml.#lines(lines);
    }

    #root(node: Y.Node): Doc {
        if (node.type === "Mapping" || node.type === "Sequence")
            return node.properties
                ? [
                      Yaml.#properties(node),
                      hardline,
                      Yaml.#comments(node.leading ?? [], false),
                      this.#collection(node),
                  ]
                : this.#collection(node);
        if (node.type === "BlockScalar") return this.#blockScalar(node, -1);
        return [this.#inline(node), Yaml.#trailing(node)];
    }

    #collection(node: Collection): Doc {
        const lines: { doc: Doc; blank: boolean }[] = [];
        // the keys of a set stay after `?`
        const set = /(?:^| )!!set(?: |$)/.test(node.properties ?? "");
        if (node.type === "Mapping")
            for (const entry of node.entries) {
                for (const { comment, blank } of entry.leading)
                    lines.push({ doc: comment.value, blank });
                lines.push({
                    doc: this.#entry(entry, set),
                    blank: entry.blank,
                });
            }
        else
            for (const item of node.items) {
                for (const { comment, blank } of item.leading)
                    lines.push({ doc: comment.value, blank });
                lines.push({ doc: this.#item(item, "-"), blank: item.blank });
            }
        for (const { comment, blank } of node.endComments)
            lines.push({ doc: comment.value, blank });
        return Yaml.#lines(lines);
    }

    #entry(entry: Y.MappingEntry, set: boolean): Doc {
        if (
            entry.explicit &&
            (!Yaml.#implicit(entry) || (set && entry.value === null))
        ) {
            const key = this.#item(
                {
                    value: entry.key,
                    comment: entry.keyComment,
                    between: entry.keyBetween,
                    betweenBlank: false,
                    inner: [],
                },
                "?",
            );
            if (!entry.value && !entry.comment && entry.between.length === 0)
                return [key, Yaml.#inner(entry.inner)];
            return [key, hardline, this.#item(entry, ":")];
        }

        const key = entry.key;
        const colon = key?.type === "Alias" ? " :" : ":";
        return [
            key ? this.#key(key) : "",
            colon,
            this.#value(entry),
            Yaml.#inner(entry.inner),
        ];
    }

    /** The value of an implicit mapping entry, after its `:`. */
    #value(entry: Y.MappingEntry): Doc {
        const { value } = entry;
        const comment = Yaml.#after(entry.comment);
        if (!value) return comment;
        if (value.type === "Mapping" || value.type === "Sequence")
            return [
                value.properties ? [" ", Yaml.#properties(value)] : "",
                comment,
                indent([
                    hardline,
                    Yaml.#comments(entry.between, entry.betweenBlank),
                    Yaml.#comments(value.leading ?? [], false),
                    this.#collection(value),
                ]),
            ];
        // comments before the value keep it on the lines after the key
        if (entry.comment || entry.between.length > 0)
            return [
                comment,
                indent([
                    hardline,
                    Yaml.#comments(entry.between, entry.betweenBlank),
                    this.#own(value, true),
                ]),
            ];
        if (value.type === "BlockScalar")
            return [" ", this.#blockScalar(value, 0)];
        if (value.type === "FlowMapping" || value.type === "FlowSequence") {
            // with comments, it starts on the line of the key
            if (value.comment || Yaml.#commented(value))
                return [
                    " ",
                    align(2, this.#inline(value)),
                    Yaml.#trailing(value),
                ];
            return [
                group(indent([line, this.#inline(value)])),
                Yaml.#trailing(value),
            ];
        }
        return [" ", indent(this.#inline(value)), Yaml.#trailing(value)];
    }

    /**
     * A sequence item, or the key or value of an explicit mapping entry,
     * after its indicator. Its content is aligned after the indicator, a
     * comment before it stays on the indicator's line.
     */
    #item(item: Item, indicator: "-" | "?" | ":"): Doc {
        const { value } = item;
        // a collection after the indicator is aligned, the comments after it too
        const inner = Yaml.#inner(
            item.inner,
            value?.type === "Mapping" || value?.type === "Sequence",
        );
        if (!value)
            return [
                indicator,
                item.comment ? ["  ", item.comment.value] : "",
                inner,
            ];

        const first = item.comment ?? item.between[0]?.comment;
        if (first) {
            const rest = item.comment ? item.between : item.between.slice(1);
            return [
                indicator,
                " ",
                first.value,
                align(2, [
                    hardline,
                    Yaml.#comments(rest, item.betweenBlank),
                    this.#own(value, true),
                ]),
                inner,
            ];
        }

        if (value.type === "BlockScalar")
            return [indicator, " ", this.#blockScalar(value, 0), inner];
        if (
            (value.type === "Mapping" || value.type === "Sequence") &&
            value.properties
        )
            return [
                indicator,
                " ",
                Yaml.#properties(value),
                align(2, [
                    hardline,
                    Yaml.#comments(value.leading ?? [], false),
                    this.#collection(value),
                ]),
                inner,
            ];
        return [indicator, " ", align(2, this.#own(value, false)), inner];
    }

    /**
     * A node starting a line, indented as the node it belongs to, or
     * deeper with `deeper`.
     */
    #own(node: Y.Node, deeper: boolean): Doc {
        if (node.type === "Mapping" || node.type === "Sequence")
            return node.properties
                ? [
                      Yaml.#properties(node),
                      hardline,
                      Yaml.#comments(node.leading ?? [], false),
                      this.#collection(node),
                  ]
                : this.#collection(node);
        if (node.type === "BlockScalar")
            return this.#blockScalar(node, deeper ? 1 : 0);
        return [this.#inline(node), Yaml.#trailing(node)];
    }

    /**
     * A block scalar, its content indented deeper than where it is printed.
     * An indentation indicator counts from the indentation of the node it
     * belongs to: `depth` is 1 when it is printed a level deeper than that
     * node, -1 for the node of a document, which is indented by -1.
     */
    #blockScalar(node: Y.BlockScalar, depth: -1 | 0 | 1): Doc {
        const lines = node.lines.map((text) =>
            text.length > node.indentation ? text.slice(node.indentation) : "",
        );
        let content: Doc;
        if (node.indicator === 0)
            content = indent(lines.map((text) => [hardline, text]));
        else {
            const prefix = " ".repeat(
                Math.max(node.indicator + Math.min(depth, 0), 0),
            );
            content = lines.map((text) => [
                hardline,
                text === "" ? "" : prefix + text,
            ]);
            if (depth === 1) content = dedent(content);
        }
        return [
            node.properties ? [node.properties, " "] : "",
            node.header,
            Yaml.#after(node.comment),
            content,
        ];
    }

    /** A scalar, alias or flow collection, a multi-line scalar continuing at the current indentation. */
    #inline(node: Y.Node, flow = false): Doc {
        let body: Doc;
        if (node.type === "Scalar") {
            const lines = this.#scalar(node);
            if (lines.length === 0) return node.properties ?? "";
            // in a flow collection, lines fold into spaces
            body =
                flow &&
                lines.every(
                    (text, index) =>
                        text !== "" &&
                        (index === lines.length - 1 ||
                            !/(?:^|[^\\])(?:\\\\)*\\$/.test(text)),
                )
                    ? lines.join(" ")
                    : join(hardline, lines);
        } else if (node.type === "Alias") body = node.name;
        else if (node.type === "FlowMapping" || node.type === "FlowSequence")
            body = this.#flow(node);
        else body = "";
        return node.properties ? [node.properties, " ", body] : body;
    }

    /** A mapping key, on one line. */
    #key(node: Y.Node): Doc {
        return removeLines(this.#inline(node, true));
    }

    #flow(node: Flow): Doc {
        const mapping = node.type === "FlowMapping";
        const [open, close] = mapping ? ["{", "}"] : ["[", "]"];
        if (node.items.length === 0 && node.opening.length === 0)
            return open + close;
        const spacing = mapping
            ? this.#options.bracketSpacing.mapping
            : this.#options.bracketSpacing.sequence;
        const edge = spacing ? line : softline;
        const parts: Doc[] = [];
        for (const [index, item] of node.items.entries()) {
            const last = index === node.items.length - 1;
            parts.push(this.#flowItem(item), last ? ifBreak(",") : ",");
            for (const comment of item.comments)
                parts.push(lineSuffix(` ${comment.value}`), breakParent);
            if (!last) parts.push(line);
        }
        return group([
            open,
            node.opening.map((comment) => [
                lineSuffix(` ${comment.value}`),
                breakParent,
            ]),
            indent([edge, parts]),
            edge,
            close,
        ]);
    }

    #flowItem(item: Y.FlowItem): Doc {
        const key = item.key ? this.#inline(item.key, true) : "";
        if (!item.pair) return key;
        const colon = item.key?.type === "Alias" ? " :" : ":";
        const { value } = item;
        if (!value) return [key, colon];
        if (
            (value.type === "FlowMapping" || value.type === "FlowSequence") &&
            !value.properties
        )
            return [key, colon, group(indent([line, this.#flow(value)]))];
        return [key, colon, " ", this.#inline(value, true)];
    }

    /** The lines of a scalar, quoted ones with the preferred quotes when they need no more escapes. */
    #scalar(node: Y.Scalar): string[] {
        if (node.style === "plain") return node.lines;
        const raw = node.lines.join("\n");
        const body = raw.slice(1, -1);
        let value: string;
        if (node.style === "single") {
            value = body.replace(/''/g, "'");
            // double quotes would need backslashes escaped
            if (value.includes("\\")) return node.lines;
        } else {
            // single quotes have no escapes but for quotes
            if (/\\[^"]/.test(body)) return node.lines;
            value = body.replace(/\\"/g, '"');
        }
        const doubles = value.split('"').length - 1;
        const singles = value.split("'").length - 1;
        const preferred = this.#options.quote;
        const quote =
            preferred === '"'
                ? doubles > singles
                    ? "'"
                    : '"'
                : singles > doubles
                  ? '"'
                  : "'";
        const quoted =
            quote === '"'
                ? `"${value.replace(/"/g, '\\"')}"`
                : `'${value.replace(/'/g, "''")}'`;
        return quoted.split("\n");
    }

    /** Docs on lines of their own, the ones after a blank line with one before them. */
    static #lines(lines: { doc: Doc; blank: boolean }[]): Doc {
        return lines.map(({ doc, blank }, index) =>
            index === 0 ? doc : [hardline, blank ? hardline : "", doc],
        );
    }

    /** Comment lines before a node, and a blank line after them when there was one. */
    static #comments(comments: Y.CommentLine[], blank: boolean): Doc {
        if (comments.length === 0) return "";
        return [
            comments.map(({ comment, blank }, index) => [
                index > 0 && blank ? hardline : "",
                comment.value,
                hardline,
            ]),
            blank ? hardline : "",
        ];
    }

    /**
     * Comments deeper than an entry after its value, a level deeper than it,
     * or aligned with a collection after an indicator.
     */
    static #inner(comments: Y.CommentLine[], aligned = false): Doc {
        if (comments.length === 0) return "";
        const lines = comments.map(({ comment, blank }) => [
            hardline,
            blank ? hardline : "",
            comment.value,
        ]);
        return aligned ? align(2, lines) : indent(lines);
    }

    /** Properties alone on their line, with their comment. */
    static #properties(node: Y.Node): Doc {
        return [node.properties ?? "", Yaml.#after(node.propertiesComment)];
    }

    /** The comment at the end of a node's line. */
    static #trailing(node: Y.Node): Doc {
        const comment =
            node.comment ??
            (node.type === "Scalar" && node.lines.length === 0
                ? node.propertiesComment
                : undefined);
        return comment ? lineSuffix(` ${comment.value}`) : "";
    }

    static #after(comment: Y.Comment | undefined): Doc {
        return comment ? [" ", comment.value] : "";
    }

    /** Whether an explicit entry can be written as an implicit one, its key a scalar, alias or flow collection on one line. */
    static #implicit(entry: Y.MappingEntry): boolean {
        const { key } = entry;
        if (
            !key ||
            entry.keyComment ||
            entry.keyBetween.length > 0 ||
            key.comment ||
            key.propertiesComment ||
            key.leading
        )
            return false;
        if (key.type === "Scalar") return key.lines.length <= 1;
        return (
            key.type === "Alias" ||
            ((key.type === "FlowMapping" || key.type === "FlowSequence") &&
                !Yaml.#commented(key))
        );
    }

    static #commented(node: Flow): boolean {
        return (
            node.opening.length > 0 ||
            node.items.some(
                (item) =>
                    item.comments.length > 0 ||
                    [item.key, item.value].some(
                        (child) =>
                            (child?.type === "FlowMapping" ||
                                child?.type === "FlowSequence") &&
                            Yaml.#commented(child),
                    ),
            )
        );
    }
}
