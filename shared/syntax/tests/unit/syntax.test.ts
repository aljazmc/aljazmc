import { describe, expect, test } from "@jest/globals";
import {
    isMarkdown,
    language,
    type Markdown,
    ParseError,
    parse,
    parseExpression,
    parseMarkdown,
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
});
