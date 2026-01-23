import type { Attached, Node, NodeOf, NodeType } from "@aljazmc/syntax";
import {
    breakParent,
    type Doc,
    hardline,
    join,
    line,
    lineSuffix,
    literalline,
} from "../doc.js";
import Parentheses from "./parentheses.js";
import type Section from "./section.js";

export interface Options {
    json: boolean;
    typescript: boolean;
    jsx: boolean;
    quote: '"' | "'";
    jsxQuote: '"' | "'";
    quoteProperties: "asNeeded" | "preserve";
    semicolons: boolean;
    trailingCommas: "all" | "es5" | "none";
    arrowParentheses: "always" | "asNeeded";
    bracketSpacing: boolean;
    delimiterSpacing: boolean;
    bracketSameLine: boolean;
    attributePosition: "auto" | "multiline";
    expand: "always" | "auto" | "never";
    operatorLinebreak: "after" | "before";
    indentWidth: number;
    lineWidth: number;
    useTabs: boolean;
}

/** Arguments passed from a parent printer to a child. */
export interface Args {
    expandFirstArg?: boolean;
    expandLastArg?: boolean;
    assignmentLayout?: string;
    /** Prefix the node with `;`, after its leading comments, against automatic semicolon insertion. */
    needsSemi?: boolean;
}

type Handler<T extends NodeType> = (node: NodeOf<T>, args: Args) => Doc;

type SectionType<T extends Section> = new (printer: Printer) => T;

/** Prints JavaScript, TypeScript, JSX and JSON syntax trees as documents. */
export default class Printer {
    readonly source: string;
    readonly options: Options;
    readonly #path: Node[] = [];
    readonly #handlers = new Map<NodeType, Handler<NodeType>>();
    /** Start offsets of printed comments. */
    readonly #printed = new Set<number>();
    readonly #parentheses: Parentheses;
    readonly #sections = new Map<SectionType<Section>, Section>();

    constructor(source: string, options: Options) {
        this.source = source;
        this.options = options;
        this.#parentheses = new Parentheses(this);
    }

    get semi(): string {
        return this.options.semicolons ? ";" : "";
    }

    get useTabs(): boolean {
        return this.options.useTabs;
    }

    readonly #groupIds = new WeakMap<Node, symbol>();

    /** A stable group id for a node, for documents depending on whether it breaks. */
    groupId(node: Node): symbol {
        let id = this.#groupIds.get(node);
        if (!id) {
            id = Symbol(node.type);
            this.#groupIds.set(node, id);
        }
        return id;
    }

    /** The shared instance of a section of printers. */
    section<T extends Section>(type: SectionType<T>): T {
        let section = this.#sections.get(type);
        if (!section) {
            section = new type(this);
            this.#sections.set(type, section);
        }
        return section as T;
    }

    handle<T extends NodeType>(types: T[], handler: Handler<T>): void {
        for (const type of types)
            this.#handlers.set(type, handler as unknown as Handler<NodeType>);
    }

    print(node: Node | null | undefined, args: Args = {}): Doc {
        if (!node) return "";
        const handler = this.#handlers.get(node.type);
        if (!handler) throw new Error(`Cannot print ${node.type}`);

        this.#path.push(node);
        try {
            let doc = handler(node, args);
            if (this.#parentheses.needs(node)) doc = ["(", doc, ")"];
            if (args.needsSemi) doc = [";", doc];
            return this.#comments(node, doc);
        } finally {
            this.#path.pop();
        }
    }

    /** Whether the current node, the top of the path, needs parentheses. */
    needsParentheses(node: Node): boolean {
        return this.node === node && this.#parentheses.needs(node);
    }

    /** Prints the current node again, as if its parent printed it. */
    printCurrent(args: Args = {}): Doc {
        const node = this.#path.pop() as Node;
        try {
            return this.print(node, args);
        } finally {
            this.#path.push(node);
        }
    }

    /** Runs a printer with the node as the current one, without printing it. */
    within<T>(node: Node, print: () => T): T {
        this.#path.push(node);
        try {
            return print();
        } finally {
            this.#path.pop();
        }
    }

    /** Wraps a document with the node's leading and trailing comments. */
    withComments(node: Node, doc: Doc): Doc {
        return this.#comments(node, doc);
    }

    /** Prints the node's leading comments and the node without them, for printers placing them elsewhere. */
    printLeadingSeparately(node: Node): { leading: Doc; doc: Doc } {
        const comments = node.comments;
        const leading =
            comments?.filter((comment) => comment.placement === "leading") ??
            [];
        if (leading.length === 0) return { leading: "", doc: this.print(node) };
        node.comments =
            comments?.filter((comment) => comment.placement !== "leading") ??
            [];
        try {
            return {
                leading: leading.map((comment) => this.#leading(comment)),
                doc: this.print(node),
            };
        } finally {
            if (comments) node.comments = comments;
        }
    }

    /** Prints the node without its comments, for printers handling them separately. */
    printBare(node: Node, args: Args = {}): Doc {
        const comments = node.comments;
        delete node.comments;
        try {
            return this.print(node, args);
        } finally {
            if (comments) node.comments = comments;
        }
    }

    /** The node being printed. */
    get node(): Node {
        return this.#path.at(-1) as Node;
    }

    /** An ancestor of the node being printed, 0 is the parent. */
    parent(level = 0): Node | undefined {
        return this.#path.at(-2 - level);
    }

    /** Ancestors from the parent outwards. */
    ancestors(): Node[] {
        return this.#path.slice(0, -1).reverse();
    }

    /** Whether the comment starting at the offset was printed. */
    isPrinted(start: number): boolean {
        return this.#printed.has(start);
    }

    // Comments

    hasComment(
        node: Node | null | undefined,
        filter?: (comment: Attached) => boolean,
    ): boolean {
        return (
            node?.comments?.some((comment) => !filter || filter(comment)) ??
            false
        );
    }

    hasLeadingComment(node: Node | null | undefined): boolean {
        return this.hasComment(
            node,
            (comment) => comment.placement === "leading",
        );
    }

    hasTrailingComment(node: Node | null | undefined): boolean {
        return this.hasComment(
            node,
            (comment) => comment.placement === "trailing",
        );
    }

    hasTrailingLineComment(node: Node | null | undefined): boolean {
        return this.hasComment(
            node,
            (comment) =>
                comment.placement === "trailing" && comment.type === "Line",
        );
    }

    hasLeadingOwnLineComment(node: Node): boolean {
        return this.hasComment(
            node,
            (comment) =>
                comment.placement === "leading" && this.hasNewline(comment.end),
        );
    }

    hasDangling(node: Node | null | undefined): boolean {
        return this.hasComment(
            node,
            (comment) => comment.placement === "dangling",
        );
    }

    /** Prints a comment's text. */
    comment(comment: Attached): Doc {
        this.#printed.add(comment.start);
        if (comment.type === "Line") return comment.value.trimEnd();

        const inner = comment.value.slice(2, -2);
        const lines = inner.split("\n");
        if (
            lines.length > 1 &&
            `*${inner}*`
                .split("\n")
                .every((text) => text.trimStart().startsWith("*"))
        ) {
            return [
                "/*",
                join(
                    hardline,
                    lines.map((text, index) =>
                        index === 0
                            ? text.trimEnd()
                            : ` ${index < lines.length - 1 ? text.trim() : text.trimStart()}`,
                    ),
                ),
                "*/",
            ];
        }
        return join(literalline, comment.value.split("\n"));
    }

    /** Prints dangling comments, optionally indented on their own lines. */
    dangling(
        node: Node,
        {
            indented = false,
            filter,
        }: { indented?: boolean; filter?: (comment: Attached) => boolean } = {},
    ): Doc {
        const comments = (node.comments ?? []).filter(
            (comment) =>
                comment.placement === "dangling" &&
                (!filter || filter(comment)),
        );
        if (comments.length === 0) return "";
        const doc: Doc[] = [];
        for (const [index, comment] of comments.entries()) {
            const previous = comments[index - 1];
            if (previous)
                doc.push(
                    hardline,
                    this.isNextLineEmpty(previous.end) ? hardline : "",
                );
            doc.push(this.comment(comment));
        }
        if (comments.some((comment) => comment.type === "Line"))
            doc.push(breakParent);
        return indented ? { type: "indent", contents: [hardline, doc] } : doc;
    }

    #comments(node: Node, doc: Doc): Doc {
        const comments = node.comments?.filter(
            (comment) => comment.placement !== "dangling",
        );
        if (!comments || comments.length === 0) return doc;

        const leading: Doc[] = [];
        const trailing: Doc[] = [];
        let previous: { block: boolean; suffix: boolean } | undefined;

        for (const comment of comments) {
            if (comment.placement === "leading")
                leading.push(this.#leading(comment));
            else {
                const printed = this.#trailing(comment, previous);
                trailing.push(printed.doc);
                previous = printed;
            }
        }

        return [...leading, doc, ...trailing];
    }

    #leading(comment: Attached): Doc {
        const parts: Doc[] = [this.comment(comment)];
        if (comment.type === "Block") {
            parts.push(
                this.hasNewline(comment.end)
                    ? this.hasNewline(comment.start, true)
                        ? hardline
                        : line
                    : " ",
            );
        } else parts.push(hardline);

        const after = this.#skipNewline(this.#skipSpaces(comment.end));
        if (after !== -1 && this.hasNewline(after)) parts.push(hardline);
        return parts;
    }

    #trailing(
        comment: Attached,
        previous?: { block: boolean; suffix: boolean },
    ): { doc: Doc; block: boolean; suffix: boolean } {
        const printed = this.comment(comment);
        const block = comment.type === "Block";

        if (
            (previous?.suffix && !previous.block) ||
            this.hasNewline(comment.start, true)
        ) {
            const empty = this.isPreviousLineEmpty(comment.start);
            return {
                doc: lineSuffix([hardline, empty ? hardline : "", printed]),
                block,
                suffix: true,
            };
        }
        if (!block || previous?.suffix)
            return {
                doc: [lineSuffix([" ", printed]), block ? "" : breakParent],
                block,
                suffix: true,
            };
        return { doc: [" ", printed], block, suffix: false };
    }

    // Source text

    #skipSpaces(index: number, backwards = false): number {
        let position = index;
        const step = backwards ? -1 : 1;
        while (
            position >= 0 &&
            position < this.source.length &&
            " \t".includes(this.source[position] as string)
        )
            position += step;
        return position;
    }

    #skipNewline(index: number, backwards = false): number {
        if (index < 0 || index > this.source.length) return -1;
        const char = this.source[index];
        if (backwards) {
            if (this.source[index - 1] === "\r" && char === "\n")
                return index - 2;
            if (char === "\n" || char === "\r") return index - 1;
            return index;
        }
        if (char === "\r" && this.source[index + 1] === "\n") return index + 2;
        if (char === "\n" || char === "\r") return index + 1;
        return index;
    }

    /** Whether a line break follows the index (or precedes it, backwards), past spaces. */
    hasNewline(index: number, backwards = false): boolean {
        const position = this.#skipSpaces(
            backwards ? index - 1 : index,
            backwards,
        );
        const char = this.source[position];
        return char === "\n" || char === "\r";
    }

    hasNewlineInRange(start: number, end: number): boolean {
        return /[\r\n]/.test(this.source.slice(start, end));
    }

    /** Whether the line after the one where the node ends is empty. */
    isNextLineEmpty(end: number): boolean {
        let index = end;
        let previous = -1;
        while (index !== previous) {
            previous = index;
            while (
                index < this.source.length &&
                ",; \t".includes(this.source[index] as string)
            )
                index++;
            if (this.source.startsWith("/*", index)) {
                const close = this.source.indexOf("*/", index + 2);
                if (close >= 0 && !this.hasNewlineInRange(index, close))
                    index = close + 2;
            }
            while (
                index < this.source.length &&
                " \t".includes(this.source[index] as string)
            )
                index++;
        }
        if (this.source.startsWith("//", index)) {
            const match = /[\r\n]/.exec(this.source.slice(index));
            index = match ? index + match.index : this.source.length;
        }
        const next = this.#skipNewline(index);
        if (next === index) return false;
        return this.hasNewline(next);
    }

    isPreviousLineEmpty(start: number): boolean {
        let index = this.#skipSpaces(start - 1, true);
        index = this.#skipNewline(index, true);
        index = this.#skipSpaces(index, true);
        const before = this.#skipNewline(index, true);
        return before !== index;
    }

    text(node: Node): string {
        return this.source.slice(node.start, node.end);
    }
}

export type { Attached };
