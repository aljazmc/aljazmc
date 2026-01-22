import type { Comment, Language, Node } from "@aljazmc/syntax";
import type { Fix, Report, Rules } from "../rules.js";
import type Semantic from "./semantic.js";

/** What every rule sees of the file being linted. */
export interface Source {
    file: string;
    text: string;
    language: Language;
    program: Node;
    comments: Comment[];
    settings: Rules;
    parents: Map<Node, Node>;
}

export interface Range {
    start: number;
    end: number;
}

/** The view of a file a rule gets, with its options and its reports. */
export default class Context<Options extends object = object> {
    readonly options: Options;
    readonly reports: Report[] = [];
    readonly #source: Source;
    readonly #semantic: () => Semantic;

    constructor(source: Source, options: Options, semantic: () => Semantic) {
        this.#source = source;
        this.options = options;
        this.#semantic = semantic;
    }

    get file(): string {
        return this.#source.file;
    }

    get text(): string {
        return this.#source.text;
    }

    get language(): Language {
        return this.#source.language;
    }

    get program(): Node {
        return this.#source.program;
    }

    get comments(): Comment[] {
        return this.#source.comments;
    }

    get settings(): Rules {
        return this.#source.settings;
    }

    /** Scopes, bindings and references, computed on first use. */
    get semantic(): Semantic {
        return this.#semantic();
    }

    parent(node: Node): Node | undefined {
        return this.#source.parents.get(node);
    }

    /** Parents of a node, from the closest to the program. */
    *ancestors(node: Node): Generator<Node> {
        for (
            let current = this.parent(node);
            current;
            current = this.parent(current)
        )
            yield current;
    }

    report(range: Range, message: string, fix?: Fix): void {
        this.reports.push({
            start: range.start,
            end: range.end,
            message,
            ...(fix && { fix }),
        });
    }

    /** The range of a node with the parentheses around it. */
    outer(node: Node): Range {
        let { start, end } = node;
        if (!node.parenthesized) return { start, end };

        const text = this.#source.text;
        for (;;) {
            let before = start - 1;
            while (before >= 0 && /\s/.test(text[before] as string)) before--;
            const after = this.skip(end);
            if (text[before] !== "(" || text[after] !== ")") break;
            start = before;
            end = after + 1;
        }
        return { start, end };
    }

    /** The source text of a node or range. */
    slice(range: Range): string {
        return this.#source.text.slice(range.start, range.end);
    }

    /** The position after whitespace and comments. */
    skip(from: number, to: number = this.text.length): number {
        const text = this.#source.text;
        let index = from;

        while (index < to) {
            if (/\s/.test(text[index] as string)) index++;
            else if (text.startsWith("//", index))
                index = Context.#after(text, "\n", index);
            else if (text.startsWith("/*", index))
                index = Context.#after(text, "*/", index);
            else break;
        }

        return index;
    }

    /**
     * The first token between two positions, skipping whitespace, comments
     * and parentheses, like the operator between two operands.
     */
    token(from: number, to: number = this.text.length): Range {
        const text = this.#source.text;
        let index = this.skip(from, to);
        while (index < to && /[()]/.test(text[index] as string))
            index = this.skip(index + 1, to);

        let end = index;
        while (end < to && !/[\s()]/.test(text[end] as string)) {
            if (text.startsWith("//", end) || text.startsWith("/*", end)) break;
            end++;
        }

        return { start: index, end };
    }

    /** The position of a keyword or punctuator at or after a position, outside comments. */
    find(value: string, from: number, to: number = this.text.length): Range {
        const text = this.#source.text;
        for (
            let index = this.skip(from, to);
            index < to;
            index = this.skip(index + 1, to)
        )
            if (text.startsWith(value, index))
                return { start: index, end: index + value.length };
        return { start: from, end: from };
    }

    static #after(text: string, end: string, from: number): number {
        const index = text.indexOf(end, from + 2);
        return index < 0 ? text.length : index + end.length;
    }
}
