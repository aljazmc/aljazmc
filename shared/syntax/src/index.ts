import type { Node, Program } from "./ast.js";
import type { Stylesheet } from "./css/ast.js";
import CssParser from "./css/parser.js";
import type { Root as HtmlRoot } from "./html/ast.js";
import HtmlParser from "./html/parser.js";
import type { Root } from "./markdown/ast.js";
import Blocks, { type MarkdownOptions } from "./markdown/blocks.js";
import type { Options } from "./parser/base.js";
import Parser from "./parser/statements.js";
import type { Comment } from "./scanner.js";

export type * from "./ast.js";
export type * as Css from "./css/ast.js";
export type * as Html from "./html/ast.js";
export { tagOf } from "./html/parser.js";
export { default as Lines } from "./lines.js";
export type * as Markdown from "./markdown/ast.js";
export type { Comment, Token } from "./scanner.js";
export { ParseError } from "./scanner.js";
export { default as Walker } from "./walker.js";
export type { MarkdownOptions, Options };

export interface Parsed {
    program: Program;
    comments: Comment[];
}

/** How a file is parsed, decided by its extension. */
export interface Language {
    json: boolean;
    typescript: boolean;
    jsx: boolean;
}

/** The language of a JavaScript, TypeScript, JSX or JSON file, undefined for others. */
export function language(file: string): Language | undefined {
    if (/\.jsonc?$/.test(file))
        return { json: true, typescript: false, jsx: false };
    if (!/\.[cm]?[jt]sx?$/.test(file)) return;
    return {
        json: false,
        typescript: /\.[cm]?tsx?$/.test(file),
        jsx: !/\.[cm]?ts$/.test(file),
    };
}

/** Whether a file is Markdown, by its extension. */
export function isMarkdown(file: string): boolean {
    return /\.(?:md|markdown)$/i.test(file);
}

/** Whether a file is HTML, by its extension. */
export function isHtml(file: string): boolean {
    return /\.html?$/i.test(file);
}

/** Whether a file is CSS, by its extension. */
export function isCss(file: string): boolean {
    return /\.css$/i.test(file);
}

/**
 * Parses CSS into rules, at-rules, declarations and selectors, throwing a
 * ParseError at the first error, or with `recover` leaving out items with
 * errors and listing the errors.
 */
export function parseCss(
    source: string,
    options: { recover?: boolean } = {},
): Stylesheet {
    return new CssParser(
        source,
        undefined,
        undefined,
        options.recover ?? false,
    ).parse();
}

/** Parses the component values of a range of CSS, like a `style` attribute value. */
export function parseCssValues(source: string, start = 0, end = source.length) {
    return CssParser.values(source, start, end);
}

/** Parses HTML, throwing a ParseError at the first error. */
export function parseHtml(source: string): HtmlRoot {
    return new HtmlParser(source).parse();
}

/** Parses CommonMark, with GitHub's tables, task lists and strikethrough unless `gfm` is false. */
export function parseMarkdown(
    source: string,
    options: MarkdownOptions = {},
): Root {
    return new Blocks(source, options).parse(options.frontmatter);
}

export function parse(source: string, options: Options): Parsed {
    const parser = new Parser(source, options);
    const program = parser.parseProgram();
    return { program, comments: parser.comments };
}

/** Parses a single expression, like a JSON document, as an expression statement program. */
export function parseExpression(source: string): Parsed {
    const parser = new Parser(source, { typescript: false, jsx: false });
    const expression: Node = parser.parseDocument();
    const statement: Node = {
        type: "ExpressionStatement",
        start: expression.start,
        end: expression.end,
        expression,
    };
    const program: Program = {
        type: "Program",
        start: 0,
        end: source.length,
        body: [statement],
        directives: [],
    };
    return { program, comments: parser.comments };
}
