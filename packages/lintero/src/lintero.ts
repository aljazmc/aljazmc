import { Includes } from "@aljazmc/config";
import {
    type Comment,
    type Css,
    type Html,
    isCss,
    isHtml,
    isMarkdown,
    type Language,
    Lines,
    language as languageOf,
    type Markdown,
    type Node,
    type Parsed,
    ParseError,
    parse,
    parseCss,
    parseExpression,
    parseHtml,
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
        if (isCss(file))
            return this.#settings.css.enabled && this.#includes.matches(file);
        if (isHtml(file))
            return this.#settings.html.enabled && this.#includes.matches(file);
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
        if (!this.lints(file)) return [];
        const css = isCss(file);
        const html = isHtml(file);
        const markdown = !html && isMarkdown(file);
        const language =
            markdown || html || css
                ? { json: false, typescript: false, jsx: false }
                : languageOf(file);
        if (!language) return [];
        return this.#lint(text, file, language, markdown, html, undefined, css);
    }

    #lint(
        text: string,
        file: string,
        language: Language,
        markdown: boolean,
        html: boolean,
        embeddedBindings?: ReadonlySet<string>,
        css = false,
    ): Diagnostic[] {
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
        let htmlRoot: Html.Root | undefined;
        let sheet: Css.Stylesheet | undefined;
        try {
            if (css) {
                // like Biome, rules run on what parses, errors are reported too
                sheet = parseCss(text, { recover: true });
                parsed = {
                    program: {
                        type: "Program",
                        start: 0,
                        end: text.length,
                        body: [],
                        directives: [],
                    },
                    comments: sheet.comments.map(({ start, end, value }) => ({
                        type: "Block" as const,
                        value,
                        start,
                        end,
                    })),
                };
            } else if (html) {
                htmlRoot = parseHtml(text);
                parsed = {
                    program: {
                        type: "Program",
                        start: 0,
                        end: text.length,
                        body: [],
                        directives: [],
                    },
                    comments: htmlRoot.comments.map(
                        ({ start, end, value }) => ({
                            type: "Block" as const,
                            value,
                            start,
                            end,
                        }),
                    ),
                };
            } else if (markdown) {
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
            ...(htmlRoot && {
                html: htmlRoot,
                htmlParents: Lintero.#htmlParents(htmlRoot),
            }),
            ...(sheet && {
                css: sheet,
                cssParents: Lintero.#cssParents(sheet),
            }),
            comments: parsed.comments,
            ...(embeddedBindings && { embeddedBindings }),
            settings: this.#settings,
            manifest: this.#manifest,
            project: this.#project,
            parents: new Map(),
        };
        const suppressions = new Suppressions(parsed.comments, lines, text);
        const diagnostics: Diagnostic[] = (sheet?.errors ?? []).map(
            ({ position, message }) =>
                diagnostic(position, position, "parse", "error", message),
        );

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

        // like Biome, scripts in HTML are linted as files of their language
        if (htmlRoot)
            for (const diagnostic of this.#scripts(htmlRoot, file, lines))
                if (
                    !suppressions.suppresses(
                        diagnostic.category,
                        diagnostic.line,
                        undefined,
                    )
                )
                    diagnostics.push(diagnostic);

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

    /** The diagnostics of the scripts of an HTML file, at their place in it. */
    #scripts(root: Html.Root, file: string, lines: Lines): Diagnostic[] {
        const scripts: { element: Html.Element; content: Html.Text }[] = [];
        const collect = (children: Html.Child[]) => {
            for (const child of children) {
                if (child.type !== "Element") continue;
                collect(child.children);
                const content = child.children[0];
                // like Biome, styles of any type are CSS
                if (
                    (child.tag === "script" || child.tag === "style") &&
                    content?.type === "Text"
                )
                    scripts.push({ element: child, content });
            }
        };
        collect(root.children);
        const embedded = Lintero.#embeddedBindings(
            scripts.filter(({ element }) => element.tag === "script"),
        );

        const diagnostics: Diagnostic[] = [];
        for (const { element, content } of scripts) {
            const css = element.tag === "style";
            const kind = css ? "css" : Lintero.#scriptKind(element);
            if (!kind) continue;
            const json = kind === "json";
            const enabled = css
                ? this.#settings.css
                : json
                  ? this.#settings.json
                  : this.#settings.javascript;
            if (!enabled.enabled) continue;
            const offset = content.start;
            const local = new Lines(content.value);
            for (const diagnostic of this.#lint(
                content.value,
                file,
                { json, typescript: false, jsx: false },
                false,
                false,
                css ? undefined : embedded,
                css,
            )) {
                const start = diagnostic.start + offset;
                const line = lines.line(start);
                const column = lines.column(start);
                // parse errors name their position in the script, it is in the file
                const message =
                    diagnostic.category === "parse"
                        ? diagnostic.message.replace(
                              /\((\d+):(\d+)\)$/,
                              (whole, row: string, col: string) =>
                                  Number(row) ===
                                      local.line(diagnostic.start) &&
                                  Number(col) === local.column(diagnostic.start)
                                      ? `(${line}:${column})`
                                      : whole,
                          )
                        : diagnostic.message;
                diagnostics.push({
                    ...diagnostic,
                    message,
                    start,
                    end: diagnostic.end + offset,
                    line,
                    column,
                    ...(diagnostic.fix && {
                        fix: {
                            ...diagnostic.fix,
                            edits: diagnostic.fix.edits.map((edit) => ({
                                ...edit,
                                start: edit.start + offset,
                                end: edit.end + offset,
                            })),
                        },
                    }),
                });
            }
        }
        return diagnostics;
    }

    /**
     * The names of the top level imports and variables of module scripts.
     * Biome's HTML support collects them for templates to use, and does not
     * report them as unused in any script of the file.
     */
    static #embeddedBindings(
        scripts: { element: Html.Element; content: Html.Text }[],
    ): Set<string> {
        const names = new Set<string>();
        const pattern = (node: Node | null | undefined): void => {
            if (!node) return;
            switch (node.type) {
                case "Identifier":
                    names.add(node.name);
                    return;
                case "ObjectPattern":
                    for (const property of node.properties)
                        if (property.type === "RestElement")
                            pattern(property.argument);
                        else if (property.type === "Property")
                            pattern(property.value);
                    return;
                case "ArrayPattern":
                    for (const element of node.elements) pattern(element);
                    return;
                case "AssignmentPattern":
                    pattern(node.left);
                    return;
                case "RestElement":
                    pattern(node.argument);
                    return;
            }
        };
        for (const { element, content } of scripts) {
            const type = element.attributes.find(
                (attribute) => attribute.name.toLowerCase() === "type",
            );
            if (type?.value?.text.toLowerCase() !== "module") continue;
            let program: Node;
            try {
                program = parse(content.value, {
                    typescript: false,
                    jsx: false,
                }).program;
            } catch (error) {
                if (error instanceof ParseError) continue;
                throw error;
            }
            if (program.type !== "Program") continue;
            for (let statement of program.body) {
                if (
                    statement.type === "ExportNamedDeclaration" &&
                    statement.declaration
                )
                    statement = statement.declaration;
                if (statement.type === "ImportDeclaration")
                    for (const specifier of statement.specifiers) {
                        if (
                            specifier.type === "ImportSpecifier" ||
                            specifier.type === "ImportDefaultSpecifier" ||
                            specifier.type === "ImportNamespaceSpecifier"
                        )
                            names.add(specifier.local.name);
                    }
                else if (statement.type === "VariableDeclaration")
                    for (const declarator of statement.declarations)
                        pattern(declarator.id);
            }
        }
        return names;
    }

    /** How Biome reads a script by its type: JavaScript, JSON, or not at all. */
    static #scriptKind(element: Html.Element): "js" | "json" | undefined {
        const type = element.attributes.find(
            (attribute) => attribute.name.toLowerCase() === "type",
        );
        if (!type?.value) return "js";
        const value = type.value.text.toLowerCase();
        if (
            [
                "module",
                "text/javascript",
                "application/javascript",
                "application/ecmascript",
            ].includes(value)
        )
            return "js";
        if (value === "importmap" || value === "application/json")
            return "json";
        return undefined;
    }

    static #cssParents(
        sheet: Css.Stylesheet,
    ): Map<Css.Item | Css.Block, Css.Rule | Css.AtRule | Css.Stylesheet> {
        const parents = new Map<
            Css.Item | Css.Block,
            Css.Rule | Css.AtRule | Css.Stylesheet
        >();
        const link = (
            items: Css.Item[],
            parent: Css.Rule | Css.AtRule | Css.Stylesheet,
        ) => {
            for (const item of items) {
                parents.set(item, parent);
                if (
                    (item.type === "Rule" || item.type === "AtRule") &&
                    item.block
                ) {
                    parents.set(item.block, item);
                    link(item.block.children, item);
                }
            }
        };
        link(sheet.children, sheet);
        return parents;
    }

    static #htmlParents(root: Html.Root): Map<Html.Child, Html.Element> {
        const parents = new Map<Html.Child, Html.Element>();
        const link = (element: Html.Element) => {
            for (const child of element.children) {
                parents.set(child, element);
                if (child.type === "Element") link(child);
            }
        };
        for (const child of root.children)
            if (child.type === "Element") link(child);
        return parents;
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
                Lintero.#applies(
                    rule,
                    source.language,
                    !!source.markdown,
                    !!source.html,
                    !!source.css,
                ),
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

        const sheet = source.css;
        if (sheet) {
            const handle = (key: string, node: unknown) => {
                for (const handler of (key.endsWith(":exit")
                    ? leave.get(key.slice(0, -5))
                    : enter.get(key)) ?? [])
                    handler(node as Node);
            };
            const visit = (items: Css.Item[]) => {
                for (const item of items)
                    if (item.type === "Declaration")
                        handle("CssDeclaration", item);
                    else if (item.type === "Rule" || item.type === "AtRule") {
                        const key =
                            item.type === "Rule" ? "CssRule" : "CssAtRule";
                        handle(key, item);
                        if (item.block) {
                            handle("CssBlock", item.block);
                            visit(item.block.children);
                        }
                        handle(`${key}:exit`, item);
                    }
            };
            handle("CssStylesheet", sheet);
            visit(sheet.children);
            handle("CssStylesheet:exit", sheet);
            return runs;
        }

        const html = source.html;
        if (html) {
            const handle = (key: string, node: unknown) => {
                for (const handler of (key.endsWith(":exit")
                    ? leave.get(key.slice(0, -5))
                    : enter.get(key)) ?? [])
                    handler(node as Node);
            };
            const visit = (element: Html.Element) => {
                handle("HtmlElement", element);
                for (const child of element.children)
                    if (child.type === "Element") visit(child);
                handle("HtmlElement:exit", element);
            };
            handle("HtmlRoot", html);
            for (const child of html.children)
                if (child.type === "Element") visit(child);
            return runs;
        }

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
        html: boolean,
        css: boolean,
    ): boolean {
        if (css) return rule.languages.includes("css");
        if (html) return rule.languages.includes("html");
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
