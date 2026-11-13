import type {
    Comment,
    Css,
    Html,
    Language,
    Markdown,
    Node,
} from "@aljazmc/syntax";
import type { Fix, Report, Rules } from "../rules.js";
import type Semantic from "./semantic.js";
import type { Manifest, Project } from "./settings.js";

/** What every rule sees of the file being linted. */
export interface Source {
    file: string;
    text: string;
    language: Language;
    program: Node;
    /** The tree of Markdown files, their program is empty. */
    markdown?: Markdown.Root;
    /** The tree of HTML files, their program is empty. */
    html?: Html.Root;
    /** The element containing each element and text of an HTML file. */
    htmlParents?: Map<Html.Child, Html.Element>;
    /** The tree of CSS files, their program is empty. */
    css?: Css.Stylesheet;
    /** The rule or at-rule containing each item of a CSS file, the stylesheet for top level ones. */
    cssParents?: Map<
        Css.Item | Css.Block,
        Css.Rule | Css.AtRule | Css.Stylesheet
    >;
    comments: Comment[];
    /**
     * Names of the top level imports and variables of the module scripts of
     * an HTML file, treated as used by every script of it.
     */
    embeddedBindings?: ReadonlySet<string>;
    settings: Rules;
    /** The closest package.json. */
    manifest: Manifest;
    project: Project;
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

    /** The tree of a Markdown file. */
    get markdown(): Markdown.Root | undefined {
        return this.#source.markdown;
    }

    /** Names a script in HTML may leave unused, see `Source.embeddedBindings`. */
    get embeddedBindings(): ReadonlySet<string> {
        return this.#source.embeddedBindings ?? new Set();
    }

    /** The tree of an HTML file. */
    get html(): Html.Root | undefined {
        return this.#source.html;
    }

    /** The tree of a CSS file. */
    get css(): Css.Stylesheet | undefined {
        return this.#source.css;
    }

    /** Whether CSS Modules syntax is on, like for `.module.css` files. */
    get cssModules(): boolean {
        return (
            this.#source.settings.css.cssModules ??
            /\.module\.css$/i.test(this.#source.file)
        );
    }

    /** The rule or at-rule containing an item of a CSS file, the stylesheet at the top level. */
    cssParent(
        node: Css.Item | Css.Block,
    ): Css.Rule | Css.AtRule | Css.Stylesheet | undefined {
        return this.#source.cssParents?.get(node);
    }

    /** The rules and at-rules containing an item of a CSS file, from the closest, without the stylesheet. */
    *cssAncestors(node: Css.Item): Generator<Css.Rule | Css.AtRule> {
        for (
            let current = this.cssParent(node);
            current && current.type !== "Stylesheet";
            current = this.cssParent(current)
        )
            yield current;
    }

    /** The element containing an element or text of an HTML file, undefined at the root. */
    htmlParent(node: Html.Child): Html.Element | undefined {
        return this.#source.htmlParents?.get(node);
    }

    /** The elements containing an element or text of an HTML file, from the closest. */
    *htmlAncestors(node: Html.Child): Generator<Html.Element> {
        for (
            let current = this.htmlParent(node);
            current;
            current = this.htmlParent(current)
        )
            yield current;
    }

    get comments(): Comment[] {
        return this.#source.comments;
    }

    get settings(): Rules {
        return this.#source.settings;
    }

    get manifest(): Manifest {
        return this.#source.manifest;
    }

    get project(): Project {
        return this.#source.project;
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

    report(range: Range, message: string, fix?: Fix, instance?: string): void {
        this.reports.push({
            start: range.start,
            end: range.end,
            message,
            ...(fix && { fix }),
            ...(instance !== undefined && { instance }),
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
