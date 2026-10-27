import { Includes } from "@aljazmc/config";
import {
    type Comment,
    isMarkdown,
    type Language,
    Lines,
    language as languageOf,
    type Markdown,
    type Node,
    type Parsed,
    ParseError,
    parse,
    parseExpression,
    parseMarkdown,
    Walker,
} from "@aljazmc/syntax";
import Context, { type Source } from "./analysis/context.js";
import Semantic from "./analysis/semantic.js";
import Settings, {
    type Active,
    type Manifest,
    type Project,
} from "./analysis/settings.js";
import Suppressions from "./analysis/suppressions.js";
import all from "./rules/index.js";
import type { Edit, Fix, Rule, Rules, Severity } from "./rules.js";

export interface Diagnostic {
    file: string;
    start: number;
    end: number;
    line: number;
    column: number;
    /** Like `lint/suspicious/noDebugger`, `suppressions/unused` or `parse`. */
    category: string;
    severity: Severity;
    message: string;
    fix?: Fix & { kind: "safe" | "unsafe" };
}

type Handler = (node: Node) => void;

export default class Lintero {
    readonly active: Active[];
    readonly #settings: Rules;
    readonly #manifest: Manifest;
    readonly #project: Project;
    readonly #includes: Includes;

    constructor(
        settings: Rules,
        manifest: Manifest = {},
        rules: Rule[] = all,
        project: Project = {},
    ) {
        this.#settings = settings;
        this.#manifest = manifest;
        this.#project = project;
        this.active = Settings.resolve(
            settings,
            rules,
            Settings.detect(manifest),
        );
        this.#includes = new Includes(settings.includes);
    }

    /** Whether the settings lint a file at all. */
    lints(file: string): boolean {
        if (!this.#settings.enabled) return false;
        if (isMarkdown(file))
            return (
                this.#settings.markdown.enabled && this.#includes.matches(file)
            );
        const language = languageOf(file);
        if (!language) return false;
        if (
            !(language.json ? this.#settings.json : this.#settings.javascript)
                .enabled
        )
            return false;
        return this.#includes.matches(file);
    }

    lint(text: string, file: string): Diagnostic[] {
        const markdown = isMarkdown(file);
        const language = markdown
            ? { json: false, typescript: false, jsx: false }
            : languageOf(file);
        if (!language || !this.lints(file)) return [];

        const lines = new Lines(text);
        const diagnostic = (
            start: number,
            end: number,
            category: string,
            severity: Severity,
            message: string,
        ): Diagnostic => ({
            file,
            start,
            end,
            line: lines.line(start),
            column: lines.column(start),
            category,
            severity,
            message,
        });

        let parsed: Parsed;
        let root: Markdown.Root | undefined;
        try {
            if (markdown) {
                root = parseMarkdown(text);
                parsed = {
                    program: {
                        type: "Program",
                        start: 0,
                        end: text.length,
                        body: [],
                        directives: [],
                    },
                    comments: Lintero.#htmlComments(root, text),
                };
            } else
                parsed = language.json
                    ? parseExpression(text)
                    : parse(text, language);
        } catch (error) {
            if (!(error instanceof ParseError)) throw error;
            return [
                diagnostic(
                    error.position,
                    error.position,
                    "parse",
                    "error",
                    error.message,
                ),
            ];
        }

        const source: Source = {
            file,
            text,
            language,
            program: parsed.program,
            ...(root && { markdown: root }),
            comments: parsed.comments,
            settings: this.#settings,
            manifest: this.#manifest,
            project: this.#project,
            parents: new Map(),
        };
        const suppressions = new Suppressions(parsed.comments, lines, text);
        const diagnostics: Diagnostic[] = [];

        for (const { active, context } of this.#run(source)) {
            const { rule, severity, fix } = active;
            const category = `lint/${rule.group}/${rule.name}`;

            for (const report of context.reports) {
                const line = lines.line(report.start);
                if (suppressions.suppresses(category, line, report.instance))
                    continue;

                const result = diagnostic(
                    report.start,
                    report.end,
                    category,
                    severity,
                    report.message,
                );
                if (report.fix && fix !== "none")
                    result.fix = { ...report.fix, kind: fix };
                diagnostics.push(result);
            }
        }

        const known = new Set(
            this.active.map(({ rule }) => `lint/${rule.group}/${rule.name}`),
        );
        // only rules lintero runs can tell whether a suppression is needed
        for (const suppression of suppressions.suppressions)
            if (
                !suppression.used &&
                suppression.categories.every((category) => known.has(category))
            )
                diagnostics.push(
                    diagnostic(
                        suppression.comment.start,
                        suppression.comment.end,
                        "suppressions/unused",
                        "warn",
                        "Suppression comment has no effect. Remove the suppression or make sure you are suppressing the correct rule.",
                    ),
                );
        for (const error of suppressions.errors)
            diagnostics.push(
                diagnostic(
                    error.start,
                    error.end,
                    "suppressions/parse",
                    "error",
                    error.message,
                ),
            );

        return diagnostics.sort(
            (a, b) => a.start - b.start || a.category.localeCompare(b.category),
        );
    }

    /** Applies safe fixes, and unsafe ones too when asked, until none apply. */
    fix(text: string, file: string, unsafe = false): string {
        let current = text;

        for (let pass = 0; pass < 10; pass++) {
            const edits: Edit[] = [];
            for (const { fix } of this.lint(current, file)) {
                if (!fix || (fix.kind === "unsafe" && !unsafe)) continue;
                const overlaps = fix.edits.some((edit) =>
                    edits.some(
                        (other) =>
                            (edit.start < other.end &&
                                other.start < edit.end) ||
                            edit.start === other.start,
                    ),
                );
                if (!overlaps) edits.push(...fix.edits);
            }
            if (edits.length === 0) break;

            for (const edit of edits.sort((a, b) => b.start - a.start))
                current =
                    current.slice(0, edit.start) +
                    edit.text +
                    current.slice(edit.end);
        }

        return current;
    }

    /** Runs the rules for the language in one traversal. */
    #run(source: Source): { active: Active; context: Context }[] {
        let semantic: Semantic | undefined;
        const lazy = () => {
            semantic ??= new Semantic(
                source.program,
                source.text,
                /\.d\.[cm]?ts$/.test(source.file),
            );
            return semantic;
        };

        const enter = new Map<string, Handler[]>();
        const leave = new Map<string, Handler[]>();
        const runs = this.active
            .filter(({ rule }) =>
                Lintero.#applies(rule, source.language, !!source.markdown),
            )
            .map((active) => {
                const context = new Context(source, active.options, lazy);
                const visitor = active.rule.create(context);
                for (const [key, handler] of Object.entries(visitor) as [
                    string,
                    Handler,
                ][]) {
                    const [type, exit] = key.split(":") as [string, string?];
                    const handlers = exit ? leave : enter;
                    handlers.set(type, [
                        ...(handlers.get(type) ?? []),
                        handler,
                    ]);
                }
                return { active, context };
            });

        if (runs.length === 0) return runs;

        const markdown = source.markdown;
        if (markdown) {
            const visit = (node: Markdown.Node) => {
                const handle = (handlers: Handler[] | undefined) => {
                    for (const handler of handlers ?? [])
                        handler(node as unknown as Node);
                };
                handle(enter.get(node.type));
                for (const child of Lintero.#markdownChildren(node))
                    visit(child);
                handle(leave.get(node.type));
            };
            visit(markdown);
            return runs;
        }

        // every parent is known before rules run, also of nodes ahead
        const children = new Map<Node, Node[]>();
        const link = (node: Node) => {
            const list = Walker.children(node);
            children.set(node, list);
            for (const child of list) {
                source.parents.set(child, node);
                link(child);
            }
        };
        link(source.program);

        const visit = (node: Node) => {
            for (const handler of enter.get("*") ?? []) handler(node);
            for (const handler of enter.get(node.type) ?? []) handler(node);
            for (const child of children.get(node) ?? []) visit(child);
            for (const handler of leave.get(node.type) ?? []) handler(node);
        };
        visit(source.program);

        return runs;
    }

    static #markdownChildren(node: Markdown.Node): Markdown.Node[] {
        if (node.type === "Table") return node.rows;
        if (node.type === "TableRow") return node.cells;
        return "children" in node ? node.children : [];
    }

    /** HTML comments of a Markdown file, which can be suppression comments. */
    static #htmlComments(root: Markdown.Root, text: string): Comment[] {
        const comments: Comment[] = [];
        const starts = [0];
        for (const match of text.matchAll(/\r\n|\r|\n/g))
            starts.push(match.index + match[0].length);
        const add = (start: number, value: string) => {
            if (value.startsWith("<!--") && value.endsWith("-->"))
                comments.push({
                    type: "Block",
                    value,
                    start,
                    end: start + value.length,
                });
        };
        const inlines = (
            nodes: Markdown.Inline[],
            block: Markdown.Paragraph | Markdown.Heading,
        ) => {
            for (const node of nodes) {
                if ("children" in node) inlines(node.children, block);
                if (node.type !== "Html") continue;
                // inline offsets are into the text of the block, without the prefixes of its lines
                const before = block.text.slice(0, node.start).split("\n");
                const index = before.length - 1;
                const column = before.at(-1)?.length ?? 0;
                if (block.type === "Paragraph")
                    add(
                        (starts[block.line - 1 + index] ?? 0) +
                            (block.prefixes[index]?.length ?? 0) +
                            column,
                        node.raw,
                    );
                else if (!block.setext)
                    add(
                        block.start +
                            (/^#+[ \t]*/.exec(text.slice(block.start))?.[0]
                                .length ?? 0) +
                            column,
                        node.raw,
                    );
            }
        };
        const blocks = (nodes: Markdown.Block[]) => {
            for (const node of nodes)
                if (node.type === "HtmlBlock") {
                    const raw = text.slice(node.start, node.end);
                    const offset = raw.indexOf("<!--");
                    if (offset >= 0)
                        add(node.start + offset, raw.slice(offset).trimEnd());
                } else if (node.type === "Paragraph" || node.type === "Heading")
                    inlines(node.children, node);
                else if (node.type === "BlockQuote") blocks(node.children);
                else if (node.type === "List")
                    for (const item of node.children) blocks(item.children);
        };
        blocks(root.children);
        return comments;
    }

    static #applies(
        rule: Rule,
        language: Language,
        markdown: boolean,
    ): boolean {
        if (markdown) return rule.languages.includes("md");
        if (language.json) return rule.languages.includes("json");
        return rule.languages.some(
            (name) =>
                name === "js" ||
                name === "jsx" ||
                (name === "ts" && language.typescript),
        );
    }
}
