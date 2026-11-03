import { describe, expect, test } from "@jest/globals";
import {
    type Css,
    type Html,
    isCss,
    isHtml,
    isMarkdown,
    language,
    type Markdown,
    ParseError,
    parse,
    parseCss,
    parseExpression,
    parseHtml,
    parseMarkdown,
    tagOf,
} from "../../src/index.ts";

/** The types of nodes, nested like the tree, for short expectations. */
const shape = (nodes: Markdown.Node[]): unknown[] =>
    nodes.map((node) => {
        const children =
            node.type === "Table"
                ? node.rows
                : "children" in node
                  ? (node.children as Markdown.Node[])
                  : [];
        return children.length > 0
            ? { [node.type]: shape(children) }
            : node.type;
    });

describe("syntax", () => {
    test("the language follows the file extension", () => {
        expect(language("a.ts")).toEqual({
            json: false,
            typescript: true,
            jsx: false,
        });
        expect(language("a.mjs")).toEqual({
            json: false,
            typescript: false,
            jsx: true,
        });
        expect(language("a.jsonc")?.json).toBe(true);
        expect(language("a.md")).toBeUndefined();
        expect(isMarkdown("a.md")).toBe(true);
        expect(isMarkdown("README.MARKDOWN")).toBe(true);
        expect(isMarkdown("a.mdx")).toBe(false);
    });

    test("the parser accepts modern syntax", () => {
        const source =
            "@decorator class A<const T> { static { } accessor #x = 1n; }\nusing r = get();\nconst t = obj?.a?.[b]?.(c) satisfies T;";
        expect(
            parse(source, { typescript: true, jsx: false }).program.body,
        ).toHaveLength(3);
    });

    test("type arguments end an expression before operators that cannot start one", () => {
        const types = (source: string) =>
            parse(source, { typescript: true, jsx: false }).program.body.map(
                (statement) =>
                    statement.type === "ExpressionStatement" &&
                    statement.expression.type === "BinaryExpression"
                        ? statement.expression.left.type
                        : undefined,
            );
        expect(
            types("a<T> * b;\na<T> === b;\na<T> / b;\na<T> <= b;\n"),
        ).toEqual(Array(4).fill("TSInstantiationExpression"));
        expect(types("a < T > +b;\na < T > -b;\n")).toEqual([
            "BinaryExpression",
            "BinaryExpression",
        ]);
    });

    test("comments are collected and errors have positions", () => {
        expect(
            parse("a(); // b\n/* c */", { typescript: false, jsx: false })
                .comments,
        ).toHaveLength(2);
        expect(() =>
            parse("const = ;", { typescript: false, jsx: false }),
        ).toThrow(ParseError);
        expect(parseExpression('{ "a": [1] }').program.body).toHaveLength(1);
    });

    describe("markdown", () => {
        test("blocks follow CommonMark, with GitHub's tables", () => {
            const root = parseMarkdown(
                "# Title\n\nText *with* `code`\nand more.\n\n> - a\n>   1. b\n\n    code\n\n<div>\nhtml\n</div>\n\n| a | b |\n| - | :-: |\n| 1 | 2 |\n\n***\n",
            );
            expect(shape(root.children)).toEqual([
                { Heading: ["Text"] },
                {
                    Paragraph: [
                        "Text",
                        { Emphasis: ["Text"] },
                        "Text",
                        "Code",
                        "Break",
                        "Text",
                    ],
                },
                {
                    BlockQuote: [
                        {
                            List: [
                                {
                                    ListItem: [
                                        { Paragraph: ["Text"] },
                                        {
                                            List: [
                                                {
                                                    ListItem: [
                                                        { Paragraph: ["Text"] },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
                "CodeBlock",
                "HtmlBlock",
                { Table: ["TableRow", "TableRow"] },
                "ThematicBreak",
            ]);
            const table = root.children[5] as Markdown.Table;
            expect(table.alignments).toEqual([null, "center"]);
            expect(table.rows[1]?.cells.map((cell) => cell.text)).toEqual([
                "1",
                "2",
            ]);
        });

        test("blocks know their lines, lists their markers and whether they are tight", () => {
            const root = parseMarkdown(
                "Title\n===\n\n1) a\n\n2) b\n- [x] done\n-   [ ] todo\n",
            );
            const [heading, ordered, bullets] = root.children as [
                Markdown.Heading,
                Markdown.List,
                Markdown.List,
            ];
            expect([heading.setext, heading.level, heading.underline]).toEqual([
                true,
                1,
                "===",
            ]);
            expect([ordered.line, ordered.endLine, ordered.tight]).toEqual([
                4,
                6,
                false,
            ]);
            expect(ordered.children.map((item) => item.number)).toEqual([1, 2]);
            expect(bullets.tight).toBe(true);
            expect(
                bullets.children.map((item) => [item.checked, item.spaces]),
            ).toEqual([
                [true, 1],
                [false, 3],
            ]);
        });

        test("definitions are blocks, references link to them", () => {
            const root = parseMarkdown(
                '[Foo  Bar]: /url "title"\n\n[foo bar] and [baz] and [x][foo bar]\n',
            );
            const [definition, paragraph] = root.children as [
                Markdown.Definition,
                Markdown.Paragraph,
            ];
            expect([definition.label, definition.destination]).toEqual([
                "[Foo  Bar]",
                "/url",
            ]);
            expect(
                paragraph.children
                    .filter((inline) => inline.type === "Link")
                    .map((link) => [link.reference, link.label]),
            ).toEqual([
                ["shortcut", "[foo bar]"],
                ["full", "[foo bar]"],
            ]);
        });

        test("emphasis is resolved like CommonMark, with strikethrough", () => {
            const [paragraph] = parseMarkdown("***a*** __b__ ~~c~~ a_b_c\n")
                .children as [Markdown.Paragraph];
            expect(shape(paragraph.children)).toEqual([
                { Emphasis: [{ Strong: ["Text"] }] },
                "Text",
                { Strong: ["Text"] },
                "Text",
                { Strikethrough: ["Text"] },
                "Text",
            ]);
            const [links] = parseMarkdown("<http://a.b> [t](</u v> 'x')\n")
                .children as [Markdown.Paragraph];
            expect(shape(links.children)).toEqual([
                "Autolink",
                "Text",
                { Link: ["Text"] },
            ]);
            expect(links.children[2]).toMatchObject({
                type: "Link",
                destination: "</u v>",
                title: "'x'",
            });
        });

        test("a byte order mark and front matter are recognized", () => {
            const root = parseMarkdown("\uFEFF---\ntitle: a\n---\n# A\n", {
                frontmatter: true,
            });
            expect(root.bom).toBe(true);
            expect(root.frontmatter?.raw).toBe("---\ntitle: a\n---");
            expect(shape(root.children)).toEqual([{ Heading: ["Text"] }]);
            expect(
                shape(parseMarkdown("---\ntitle: a\n---\n").children),
            ).toEqual(["ThematicBreak", { Heading: ["Text"] }]);
        });
    });

    describe("html", () => {
        /** Elements by name with their children, texts by value, for short expectations. */
        const tree = (children: Html.Child[]): unknown[] =>
            children.map((child) =>
                child.type === "Element"
                    ? { [child.name]: tree(child.children) }
                    : child.type === "Text"
                      ? child.value
                      : child.type,
            );

        test("elements nest, whitespace and comments are not children", () => {
            const root = parseHtml(
                "<!-- a --><div>\n  <p>Some <b>bold</b> text</p>\n  <br><img src=x />\n</div>\n",
            );
            expect(tree(root.children)).toEqual([
                {
                    div: [
                        { p: ["Some", { b: ["bold"] }, "text"] },
                        { br: [] },
                        { img: [] },
                    ],
                },
            ]);
            expect(root.comments.map((comment) => comment.value)).toEqual([
                "<!-- a -->",
            ]);
            expect(isHtml("a.html")).toBe(true);
            expect(isHtml("a.HTM")).toBe(true);
            expect(isHtml("a.xhtml")).toBe(false);
        });

        test("text ends at a blank line, unless it has braces", () => {
            const root = parseHtml("<p>a  b\n\n c</p><p>{a\n\nb}</p>");
            expect(tree(root.children)).toEqual([
                { p: ["a  b", "c"] },
                { p: ["{a\n\nb}"] },
            ]);
        });

        test("tags are known exactly or lower-cased, void and self-closing elements close themselves", () => {
            const [div, svg, custom] = parseHtml(
                '<DIV CLASS="a"></div><svg><feBlend/><foreignobject></foreignobject></svg><my-el/>',
            ).children as Html.Element[];
            expect(div).toMatchObject({ name: "DIV", tag: "div" });
            expect(div?.attributes[0]).toMatchObject({
                name: "CLASS",
                value: { raw: '"a"', text: "a", quote: '"' },
            });
            expect(svg?.children).toMatchObject([
                { tag: "feBlend", selfClosing: true, closing: null },
                { tag: null },
            ]);
            expect(custom).toMatchObject({ tag: null, selfClosing: true });
            expect(tagOf("CIRCLE")).toBe("circle");
            expect(tagOf("fegaussianblur")).toBeNull();
        });

        test("scripts, styles and preformatted elements keep their content as raw text", () => {
            const [pre, script] = parseHtml(
                "<pre>\n  <b>a</b>\n</pre><script>if (a < b) x = '</p>';</script>",
            ).children as Html.Element[];
            expect(pre).toMatchObject({ raw: true });
            expect(tree(pre?.children ?? [])).toEqual(["\n  <b>a</b>\n"]);
            expect(tree(script?.children ?? [])).toEqual([
                "if (a < b) x = '</p>';",
            ]);
        });

        test("attribute values may be unquoted, doctypes and processing instructions start files", () => {
            const root = parseHtml(
                '<?xml version="1.0"?>\n<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN">\n<a href=x/y title=\'t\' hidden></a>',
            );
            expect(root.instruction).toMatchObject({ name: "xml" });
            expect(root.doctype).toMatchObject({
                keyword: "DOCTYPE",
                name: "html",
                literal: "PUBLIC",
                identifiers: ['"-//W3C//DTD HTML 4.01//EN"'],
            });
            const [a] = root.children as Html.Element[];
            expect(
                a?.attributes.map((attribute) => attribute.value?.text),
            ).toEqual(["x/y", "t", undefined]);
        });

        test("errors are reported like Biome's", () => {
            const error = (source: string) => {
                try {
                    parseHtml(source);
                } catch (caught) {
                    if (caught instanceof ParseError)
                        return `${caught.position} ${caught.message}`;
                    throw caught;
                }
            };
            expect(error("<div><span></div>")).toBe(
                "11 Expected a matching closing tag but instead found '</div>'.",
            );
            expect(error("<p>a")).toBe(
                "4 Expected a closing tag but instead found the end of the file.",
            );
            expect(error("</div>")).toBe(
                "0 This closing tag has no matching opening tag.",
            );
            expect(error("<br></br>")).toBe(
                "4 Void elements should not have a closing tag. Remove the closing tag.",
            );
            expect(error("a < b")).toBe(
                "2 Unescaped `<` bracket character. Expected a tag or escaped character.",
            );
            expect(error("<p><![endif]--></p>")).toBe(
                "4 Expected an element name but instead found '!'.",
            );
            // a declaration starting the file is read like a doctype
            expect(error("<![endif]-->")).toBeUndefined();
            expect(error("---\n---\n")).toBe(
                "0 Frontmatter is only valid inside Astro files.",
            );
            expect(error('<a b="c></a>')).toBe("5 Missing closing quote");
        });
    });

    describe("css", () => {
        test("files are CSS by their extension", () => {
            expect(isCss("a.css")).toBe(true);
            expect(isCss("A.CSS")).toBe(true);
            expect(isCss("a.scss")).toBe(false);
        });

        test("rules, at-rules, declarations and comments", () => {
            const sheet = parseCss(
                "/* a */\n@media screen { a > .b:hover, c { color: red !important; } }\n@import 'x.css';\n",
            );
            expect(sheet.comments.map((comment) => comment.value)).toEqual([
                "/* a */",
            ]);
            const [media, imports] = sheet.children as Css.AtRule[];
            expect(media?.keyword).toBe("media");
            expect(imports?.semicolon).toBe(true);
            const rule = media?.block?.children[0] as Css.Rule;
            const [first, second] = rule.selectors?.children ?? [];
            expect(
                first?.children.map(
                    (compound) => compound.combinator?.value ?? null,
                ),
            ).toEqual([null, ">"]);
            expect(second?.children[0]?.element).toMatchObject({ name: "c" });
            const declaration = rule.block.children[0] as Css.Declaration;
            expect(declaration).toMatchObject({
                property: "color",
                value: [{ type: "Identifier", value: "red" }],
                important: { keyword: "important" },
            });
        });

        test("nested rules and declarations are told apart like Biome", () => {
            const sheet = parseCss("a { b:hover { x: 1 } c: d; &.e { } }\n");
            const block = (sheet.children[0] as Css.Rule).block;
            expect(block.children.map((child) => child.type)).toEqual([
                "Rule",
                "Declaration",
                "Rule",
            ]);
        });

        test("values keep functions, blocks and dimensions", () => {
            const sheet = parseCss(
                "a { width: calc(100% - 2px); grid: [a] 1fr / auto; b: url(x.png); }\n",
            );
            const [width, grid, url] = (sheet.children[0] as Css.Rule).block
                .children as Css.Declaration[];
            expect(width?.value[0]).toMatchObject({
                type: "Function",
                name: "calc",
            });
            expect(grid?.value.map((value) => value.type)).toEqual([
                "SimpleBlock",
                "Dimension",
                "Delimiter",
                "Identifier",
            ]);
            expect(url?.value[0]).toMatchObject({
                type: "Url",
                value: { value: "x.png" },
            });
        });

        test("errors throw, or are skipped with their items when recovering", () => {
            expect(() => parseCss("a { color: red")).toThrow(ParseError);
            const sheet = parseCss("a { color: }\nb { color: red; }\n", {
                recover: true,
            });
            expect(sheet.errors).toHaveLength(1);
            expect((sheet.children[1] as Css.Rule).block.children).toHaveLength(
                1,
            );
        });
    });
});
