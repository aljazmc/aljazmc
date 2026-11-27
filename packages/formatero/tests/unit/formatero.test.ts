import Config from "@aljazmc/config";
import defaults from "../../src/config.ts";
import EditorConfig from "../../src/editorconfig.ts";
import { formatFiles } from "../../src/files.ts";
import Formatero, { FormatError } from "../../src/formatero.ts";
import {
    conditionalGroup,
    fill,
    group,
    hardline,
    ifBreak,
    indent,
    line,
    lineSuffix,
    softline,
} from "../../src/printer/doc.ts";
import Layout from "../../src/printer/layout.ts";
import { biome } from "../biome.ts";

const format = (source: string, file = "a.ts", rules: object = {}) =>
    new Formatero(
        Config.merge(defaults.rules, {
            indentStyle: "space",
            indentWidth: 4,
            ...rules,
        }),
    ).format(source, file);

describe("formatero", () => {
    describe("prints like Biome", () => {
        test.each(biome)("$name", ({ file, rules, input, expected }) => {
            expect(format(input, file, rules)).toBe(expected);
            expect(format(expected, file, rules)).toBe(expected);
        });
    });

    describe("layout", () => {
        const layout = (doc: Parameters<Layout["print"]>[0], lineWidth = 20) =>
            new Layout({ lineWidth, useTabs: false, indentWidth: 4 }).print(
                doc,
            );
        const list = group([
            "[",
            indent([softline, "aaaaa,", line, "bbbbb,", line, "ccccc"]),
            softline,
            "]",
        ]);

        test("groups stay flat when they fit, break when not", () => {
            expect(layout(list, 40)).toBe("[aaaaa, bbbbb, ccccc]");
            expect(layout(list, 10)).toBe(
                "[\n    aaaaa,\n    bbbbb,\n    ccccc\n]",
            );
        });

        test("ifBreak, conditional groups and fill", () => {
            expect(
                layout(group(["a", ifBreak("broken", "flat"), softline]), 10),
            ).toBe("aflat");
            expect(
                layout(
                    conditionalGroup([
                        "too long for the line",
                        group(["short", hardline, "x"]),
                    ]),
                ),
            ).toBe("short\nx");
            expect(layout(fill(["aaaa", line, "bbbb", line, "cccc"]), 10)).toBe(
                "aaaa bbbb\ncccc",
            );
        });

        test("line suffixes wait for the end of the line", () => {
            expect(layout(["a", lineSuffix(" // c"), "b", hardline, "d"])).toBe(
                "ab // c\nd",
            );
        });
    });

    describe("errors", () => {
        test("syntax errors are reported, or formatted by tokens with formatWithErrors", () => {
            expect(() => format("const = ;\n")).toThrow(FormatError);
            expect(() => format("a;\nconst = ;\n")).toThrow(/^2:7 /);
            expect(
                format("let  a =  'b'\nconst = ;\n", "a.ts", {
                    formatWithErrors: true,
                }),
            ).toBe('let  a =  "b";\nconst = ;\n');
        });

        test("HTML must close its elements, like Biome", () => {
            const html = { html: { enabled: true } };
            expect(() => format("<div><span></div>\n", "a.html", html)).toThrow(
                "1:12 Expected a matching closing tag but instead found '</div>'.",
            );
            expect(() => format("<p>a\n", "a.html", html)).toThrow(
                "2:1 Expected a closing tag but instead found the end of the file.",
            );
            expect(() => format("<p>a < b</p>\n", "a.html", html)).toThrow(
                /^1:6 Unescaped `<`/,
            );
            expect(() => format("<br></br>\n", "a.html", html)).toThrow(
                /^1:5 Void elements should not have a closing tag/,
            );
            expect(() =>
                format("---\na: 1\n---\n<p></p>\n", "a.html", html),
            ).toThrow(/Frontmatter is only valid inside Astro files/);
            // errors in scripts are at their place in the file
            expect(() =>
                format("<p></p>\n<script>const = 1</script>\n", "a.html", html),
            ).toThrow(/^2:15 /);
        });

        test("CSS with characters Biome rejects is not formatted, like Biome", () => {
            expect(() => format("a { color: red; }\n", "a.css")).toThrow(
                "1:4 unexpected character ` `",
            );
            expect(() => format("a {​color: red; }\n", "a.css")).toThrow(
                "1:4 unexpected character `�`",
            );
            expect(() => format("a {\fcolor: red; }\n", "a.css")).toThrow(
                "1:4 The CSS standard only allows tabs, whitespace, carriage return and line feed whitespace.",
            );
            // characters of names, and any in strings and comments, are fine
            expect(format('a {é: " "; /*   */ }\n', "a.css")).toBe(
                'a {\n    é: " "; /*   */\n}\n',
            );
        });
    });

    describe("files", () => {
        test("enabled turns formatting off, for all or one language", () => {
            const messy = "let  a =  1\n";
            expect(format(messy, "a.ts", { enabled: false })).toBe(messy);
            expect(
                format(messy, "a.ts", { javascript: { enabled: false } }),
            ).toBe(messy);
            expect(
                format('{"a":1}', "a.json", { json: { enabled: false } }),
            ).toBe('{"a":1}');
            expect(format(messy, "a.ts", { json: { enabled: false } })).toBe(
                "let a = 1;\n",
            );
            expect(
                format("* a\n", "a.md", { markdown: { enabled: false } }),
            ).toBe("* a\n");
            expect(format("* a\n", "README.markdown")).toBe("- a\n");
        });

        test("CSS fences in Markdown are formatted", () => {
            expect(format("```css\na{color:red}\n```\n", "a.md")).toBe(
                "```css\na {\n    color: red;\n}\n```\n",
            );
        });

        test("CSS is formatted unless disabled, errors stop it like Biome", () => {
            expect(format("a{color:red}\n", "a.css")).toBe(
                "a {\n    color: red;\n}\n",
            );
            expect(
                format("a{color:red}\n", "a.CSS", { css: { enabled: false } }),
            ).toBe("a{color:red}\n");
            expect(() => format("a{color:red\n", "a.css")).toThrow(FormatError);
            expect(() =>
                format("<style>a{color:red</style>\n", "a.html", {
                    html: { enabled: true },
                }),
            ).toThrow(FormatError);
        });

        test("formatero-ignore and biome-ignore suppress formatting alike", () => {
            const html = { html: { enabled: true } };
            for (const prefix of ["formatero", "biome"]) {
                expect(
                    format(
                        `<!-- ${prefix}-ignore format: kept -->\n<DIV>x</DIV>\n<DIV>y</DIV>\n`,
                        "a.html",
                        html,
                    ),
                ).toBe(
                    `<!-- ${prefix}-ignore format: kept -->\n<DIV>x</DIV>\n<div>y</div>\n`,
                );
                const file = `<!-- ${prefix}-ignore-all format: kept -->\n<DIV>x</DIV>\n`;
                expect(format(file, "a.html", html)).toBe(file);
                expect(
                    format(
                        `/* ${prefix}-ignore format: kept */\na{color:red}\nb{color:red}\n`,
                        "a.css",
                    ),
                ).toBe(
                    `/* ${prefix}-ignore format: kept */\na{color:red}\nb {\n    color: red;\n}\n`,
                );
                const sheet = `/* ${prefix}-ignore-all format: kept */\na{color:red}\n`;
                expect(format(sheet, "a.css")).toBe(sheet);
            }
        });

        test("HTML is formatted when enabled, .htm too, styles as CSS", () => {
            const messy = "<DIV>x</DIV>\n";
            expect(format(messy, "a.html")).toBe(messy);
            expect(format(messy, "a.html", { html: { enabled: true } })).toBe(
                "<div>x</div>\n",
            );
            expect(format(messy, "a.HTM", { html: { enabled: true } })).toBe(
                "<div>x</div>\n",
            );
            // styles are formatted as CSS at the level of the element
            expect(
                format("<style>\na{color:red}\n</style>\n", "a.html", {
                    html: { enabled: true },
                }),
            ).toBe("<style>\na {\n    color: red;\n}\n</style>\n");
            // HTML ends with a newline unless HTML says otherwise
            expect(
                format("<p></p>", "a.html", {
                    trailingNewline: false,
                    html: { enabled: true },
                }),
            ).toBe("<p></p>\n");
            expect(
                format("<p></p>", "a.html", {
                    html: { enabled: true, trailingNewline: false },
                }),
            ).toBe("<p></p>");
        });

        test("Markdown formats html fences when HTML is enabled", () => {
            const source = "```html\n<DIV   class=x>x</DIV>\n```\n";
            expect(format(source, "a.md")).toBe(source);
            expect(format(source, "a.md", { html: { enabled: true } })).toBe(
                '```html\n<div class="x">x</div>\n```\n',
            );
        });

        test("Markdown formats the code of its fences, unless formatEmbeds is false", () => {
            const source = "* a\n\n```ts\nlet  a\n```\n";
            expect(format(source, "a.md")).toBe("- a\n\n```ts\nlet a;\n```\n");
            expect(
                format(source, "a.md", { markdown: { formatEmbeds: false } }),
            ).toBe("- a\n\n```ts\nlet  a\n```\n");
            expect(
                format(source, "a.md", { javascript: { enabled: false } }),
            ).toBe("- a\n\n```ts\nlet  a\n```\n");
            expect(
                format(source, "a.md", {
                    javascript: { lineEnding: "crlf", trailingNewline: true },
                }),
            ).toBe("- a\n\n```ts\nlet a;\n```\n");
            expect(
                format("```js\n#!/usr/bin/env node\nlet  a\n```\n", "a.md"),
            ).toBe("```js\n#!/usr/bin/env node\nlet  a\n```\n");
        });

        test("includes selects files in order, the last match decides", () => {
            const formatero = new Formatero(
                Config.merge(defaults.rules, {
                    includes: ["src/**", "!src/generated"],
                }),
            );
            expect(formatero.formats("src/a.ts")).toBe(true);
            expect(formatero.formats("src/generated/a.ts")).toBe(false);
            expect(formatero.formats("tests/a.ts")).toBe(false);
            expect(formatero.format("let  a\n", "tests/a.ts")).toBe("let  a\n");
        });

        test("shared rules apply to every language unless it overrides them", () => {
            expect(
                format("const { a } = b;\n", "a.ts", { bracketSpacing: false }),
            ).toBe("const {a} = b;\n");
            expect(
                format("const { a } = b;\n", "a.ts", {
                    bracketSpacing: false,
                    javascript: { bracketSpacing: true },
                }),
            ).toBe("const { a } = b;\n");
        });
    });

    describe("editorconfig", () => {
        const editorconfig = new EditorConfig(
            [
                "root = true",
                "",
                "[*]",
                "indent_style = space",
                "indent_size = 2",
                "end_of_line = crlf",
                "insert_final_newline = false",
                "",
                "# Makefiles need tabs",
                "[{Makefile,*.mk}]",
                "indent_style = tab",
                "indent_size = tab",
                "tab_width = 8",
            ].join("\n"),
        );

        test("reads indentation, line endings and final newlines", () => {
            expect(editorconfig.rules("src/a.ts")).toEqual({
                indentStyle: "space",
                indentWidth: 2,
                lineEnding: "crlf",
                trailingNewline: false,
            });
        });

        test("section globs match like Biome's", () => {
            const matches = (glob: string, file: string) =>
                new EditorConfig(`[${glob}]\nindent_size = 7\n`).rules(file)
                    .indentWidth === 7;
            // a bracket expression in braces, and nested braces
            expect(matches("{[ab],c}.json", "a.json")).toBe(true);
            expect(matches("{[ab],c}.json", "b.json")).toBe(true);
            expect(matches("{[ab],c}.json", "c.json")).toBe(true);
            expect(matches("{[ab],c}.json", "d.json")).toBe(false);
            expect(matches("{*.{js,json},biome.jsonc}", "a.json")).toBe(true);
            expect(matches("{*.{js,json},biome.jsonc}", "biome.jsonc")).toBe(
                true,
            );
            expect(matches("{*.{js,json},biome.jsonc}", "a.ts")).toBe(false);
            // a single unmatched brace makes every brace literal
            expect(matches("{a,b}}.json", "{a,b}}.json")).toBe(true);
            expect(matches("{a,b}}.json", "a}.json")).toBe(false);
            expect(matches("{a,{b,c}", "a")).toBe(false);
            // braces without a comma are literal, numeric ranges are not
            expect(matches("{a}.js", "{a}.js")).toBe(true);
            expect(matches("{a}.js", "a.js")).toBe(false);
            expect(matches("{1..3}.js", "2.js")).toBe(true);
            expect(matches("{1..3}.js", "4.js")).toBe(false);
            // `*` and `?` stay in a folder, globs with `/` start at the root
            expect(matches("a?c.js", "a/c.js")).toBe(false);
            expect(matches("[!ab].js", "c.js")).toBe(true);
            expect(matches("src/*.js", "src/a.js")).toBe(true);
            expect(matches("src/*.js", "src/x/a.js")).toBe(false);
            expect(matches("src/*.js", "x/src/a.js")).toBe(false);
            expect(matches("src/**/*.js", "src/x/a.js")).toBe(true);
            expect(matches("/root.js", "root.js")).toBe(true);
            expect(matches("/root.js", "x/root.js")).toBe(false);
            expect(matches("\\*.js", "a.js")).toBe(false);
        });

        test("later sections win, braces list alternatives", () => {
            expect(editorconfig.rules("Makefile")).toMatchObject({
                indentStyle: "tab",
                indentWidth: 8,
            });
            expect(editorconfig.rules("build/rules.mk")).toMatchObject({
                indentStyle: "tab",
            });
        });
    });

    describe("lines", () => {
        test("lineEnding and trailingNewline", () => {
            expect(
                format("a();\nb();\n\n\n", "a.ts", { lineEnding: "crlf" }),
            ).toBe("a();\r\nb();\r\n");
            expect(format("a();\n", "a.ts", { trailingNewline: false })).toBe(
                "a();",
            );
        });

        test("Markdown has the line endings and final newline of its rules", () => {
            expect(
                format("# a\r\n\r\nb", "a.md", {
                    markdown: { lineEnding: "crlf", trailingNewline: false },
                }),
            ).toBe("# a\r\n\r\nb");
            expect(format("\uFEFF# a\n", "a.md")).toBe("\uFEFF# a\n");
        });

        test("text files are reindented line by line, a tab is one level", () => {
            expect(format("a:\n  b:\n\t\tc\n", "a.toml")).toBe(
                "a:\n    b:\n        c\n",
            );
        });
    });

    describe("yaml", () => {
        const yaml = (source: string, rules: object = {}, file = "a.yml") =>
            format(source, file, rules);

        test("invalid YAML is reported where it is, or left as it is with formatWithErrors", () => {
            expect(() => yaml("a:\n\tb: 1\n")).toThrow(
                "2:1 Tabs are not allowed for indentation in YAML.",
            );
            expect(() => yaml("a: b: c\n")).toThrow(FormatError);
            expect(() => yaml('a: "b\n')).toThrow(/^1:4 Unterminated string/);
            expect(() => yaml("a: [b, c\n")).toThrow(/^1:4 Unterminated flow/);
            expect(() => yaml("a: 1\n- b\n")).toThrow(/^2:1 /);
            expect(() => yaml("a: &x *y\n")).toThrow(/cannot have a tag/);
            expect(yaml("a:\n\tb:  1\n", { formatWithErrors: true })).toBe(
                "a:\n\tb:  1\n",
            );
        });

        test("content after an indentation indicator moves with its key", () => {
            // the indicator counts from the key's indentation
            expect(yaml("a:\n  b: |2\n      x\n     y\n")).toBe(
                "a:\n    b: |2\n        x\n       y\n",
            );
            expect(yaml("- |1\n   x\n")).toBe("- |1\n   x\n");
            expect(yaml("--- |2\n   x\n")).toBe("---\n|2\n   x\n");
        });

        test("quotes are the preferred ones unless they need more escapes", () => {
            const single = { yaml: { quoteStyle: "single" } };
            expect(yaml('a: "x"\nb: "it\'s"\nc: "\\t"\n', single)).toBe(
                'a: \'x\'\nb: "it\'s"\nc: "\\t"\n',
            );
            expect(yaml("a: 'x'\nb: 'say \"hi\"'\nc: 'C:\\a'\n")).toBe(
                "a: \"x\"\nb: 'say \"hi\"'\nc: 'C:\\a'\n",
            );
        });

        test("flow mappings are spaced by bracketSpacing, flow sequences only by YAML's own", () => {
            const source = "a: {b: 1}\nc: [d]\n";
            expect(yaml(source)).toBe("a: { b: 1 }\nc: [d]\n");
            expect(yaml(source, { bracketSpacing: false })).toBe(
                "a: {b: 1}\nc: [d]\n",
            );
            expect(yaml(source, { yaml: { bracketSpacing: true } })).toBe(
                "a: { b: 1 }\nc: [ d ]\n",
            );
        });

        test("line endings, a byte order mark and tabs", () => {
            expect(yaml("a:\r\n  b: 1\r\n")).toBe("a:\n    b: 1\n");
            expect(yaml("a:\n  b: 1\n", { lineEnding: "crlf" })).toBe(
                "a:\r\n    b: 1\r\n",
            );
            expect(yaml("\uFEFFa:   1\n")).toBe("\uFEFFa: 1\n");
            // YAML is never indented with tabs
            expect(yaml("a:\n  b: 1\n", { indentStyle: "tab" })).toBe(
                "a:\n    b: 1\n",
            );
            expect(yaml("")).toBe("");
        });

        test("in its own files, Markdown blocks and only when enabled", () => {
            expect(yaml("a:   1\n", {}, "a.yaml")).toBe("a: 1\n");
            expect(format("```yaml\na:\n  b:   1\n```\n", "a.md", {})).toBe(
                "```yaml\na:\n    b: 1\n```\n",
            );
            expect(yaml("a:   1\n", { yaml: { enabled: false } })).toBe(
                "a:   1\n",
            );
        });

        test("comments keep their order and formatting is stable", () => {
            const source =
                "a:\n  - - x\n\n   # deeper\n  - |+\n    y\n#x\n    # z\nb: 1\n";
            const once = yaml(source);
            expect(yaml(once)).toBe(once);
            expect(once.indexOf("#x")).toBeLessThan(once.indexOf("# z"));
        });
    });

    describe("regressions", () => {
        /** Formats, and checks that formatting the output changes nothing. */
        const stable = (source: string, file = "a.ts", rules: object = {}) => {
            const once = format(source, file, rules);
            expect(format(once, file, rules)).toBe(once);
            return once;
        };

        test("line comments in empty brackets get lines of their own, not hiding the bracket", () => {
            expect(stable("const f = ( // C\n) => 1;\n")).toBe(
                "const f = (\n    // C\n) => 1;\n",
            );
            expect(stable("function g( // C\n) {}\n")).toBe(
                "function g(\n    // C\n) {}\n",
            );
            expect(stable("class A {\n    m( // C\n    ) {}\n}\n")).toBe(
                "class A {\n    m(\n        // C\n    ) {}\n}\n",
            );
            expect(stable("x = <div>{ // C\n}</div>;\n", "a.tsx")).toBe(
                "x = (\n    <div>\n        {\n            // C\n        }\n    </div>\n);\n",
            );
            // block comments stay inline
            expect(stable("const f = (/* C */) => 1;\n")).toBe(
                "const f = (/* C */) => 1;\n",
            );
            expect(stable("x = <div>{/* C */}</div>;\n", "a.tsx")).toBe(
                "x = <div>{/* C */}</div>;\n",
            );
        });

        test("comments before the semicolon of break and continue are kept", () => {
            expect(
                stable(
                    "for (;;) {\n    continue /* C */;\n    break /* D */;\n}\n",
                ),
            ).toBe(
                "for (;;) {\n    continue /* C */;\n    break /* D */;\n}\n",
            );
            expect(
                stable("a: for (;;) {\n    continue a // C\n    ;\n}\n"),
            ).toBe("a: for (;;) {\n    continue a; // C\n}\n");
        });

        test("a comment that would be lost in an HTML script fails the file, not the run", () => {
            const html = { html: { enabled: true } };
            expect(() =>
                format(
                    "<script>\nfunction f() { return new /* C */.target; }\n</script>\n",
                    "a.html",
                    html,
                ),
            ).toThrow(FormatError);
            const log: string[] = [];
            const saved: string[] = [];
            const passed = formatFiles(
                [
                    { file: "a.js", path: "/a.js", text: "let  a\n" },
                    { file: "b.js", path: "/b.js", text: "b\n" },
                    { file: "c.js", path: "/c.js", text: "let  c\n" },
                ],
                (text, file) => {
                    if (file === "b.js") throw new TypeError("a bug");
                    return format(text, file);
                },
                {
                    write: true,
                    log: (line) => log.push(line),
                    save: (path) => saved.push(path),
                },
            );
            expect(passed).toBe(false);
            expect(saved).toEqual(["/a.js", "/c.js"]);
            expect(log[0]).toBe("formatted: a.js");
            expect(log[1]).toMatch(
                /^error: b\.js: formatero failed, please report it: TypeError: a bug/,
            );
            expect(log[2]).toBe("formatted: c.js");
        });

        test("Markdown lines that would start a block once unindented join the line before", () => {
            for (const proseWrap of ["preserve", "always"]) {
                const markdown = { markdown: { proseWrap } };
                const md = (source: string) => stable(source, "a.md", markdown);
                expect(md("Text:\n\t- a\n\t- b\n")).toBe("Text: - a - b\n");
                expect(md("Text\n    # not a heading\n")).toBe(
                    "Text # not a heading\n",
                );
                expect(md("Text\n    > not a quote\n")).toBe(
                    "Text > not a quote\n",
                );
                expect(md("Text\n    1. not a list\n")).toBe(
                    "Text 1. not a list\n",
                );
                expect(md("Text\n    ---\n")).toBe("Text ---\n");
            }
            // only 1 starts an ordered list that interrupts a paragraph
            expect(stable("Text\n2. stays a line\n", "a.md")).toBe(
                "Text\n2. stays a line\n",
            );
            // wrapping never starts a line with a list marker
            expect(
                stable("aaaaaaaaaa bbbbbbbb - cc dd\n", "a.md", {
                    lineWidth: 20,
                    markdown: { proseWrap: "always" },
                }),
            ).toBe("aaaaaaaaaa bbbbbbbb -\ncc dd\n");
        });

        test("comments in unions, module names and mapped types stay where they are", () => {
            expect(stable('type T =\n    | "a"\n    // B\n    | "b";\n')).toBe(
                'type T =\n    | "a"\n    // B\n    | "b";\n',
            );
            expect(stable('import {\n    a,\n    // b,\n} from "x";\n')).toBe(
                'import {\n    a,\n    // b,\n} from "x";\n',
            );
            expect(stable('import { // C\n} from "x";\n')).toBe(
                'import {\n    // C\n} from "x";\n',
            );
            expect(
                stable(
                    "type A = {\n    // before the key\n    [K in keyof T]:\n        // before the type\n        T[K];\n};\n",
                ),
            ).toBe(
                "type A = {\n    // before the key\n    [K in keyof T]: // before the type\n    T[K];\n};\n",
            );
            expect(stable("type B = { /* c */ [K in keyof T]: T[K] };\n")).toBe(
                "type B = { /* c */ [K in keyof T]: T[K] };\n",
            );
        });

        test("comments in parentheses that are not printed go where they print", () => {
            expect(
                stable(
                    "x = ((0x30/* 0 */ <= c) && (c <= 0x39/* 9 */)) || d;\n",
                ),
            ).toBe("x = (0x30 /* 0 */ <= c && c <= 0x39) /* 9 */ || d;\n");
            expect(stable("x = a && (( // empty\n b && c) || d);\n")).toBe(
                "x =\n    a && // empty\n    ((b && c) || d);\n",
            );
            // comments on lines of their own stay
            expect(
                stable(
                    "f = (p) => !(\n    /* start */\n    (a > b)\n    /* stop */\n);\n",
                ),
            ).toBe(
                "f = (p) =>\n    !(\n        /* start */\n        (a > b)\n        /* stop */\n    );\n",
            );
        });

        test("line comments before bodies, catch clauses and values move like Biome moves them", () => {
            expect(
                stable(
                    "interface A // C\n{\n    a: string;\n}\nfunction f(): number // D\n{\n    return 1;\n}\n",
                ),
            ).toBe(
                "interface A {\n    // C\n    a: string;\n}\nfunction f(): number {\n    // D\n    return 1;\n}\n",
            );
            expect(
                stable(
                    "interface VirtualFileSystem\n    extends // Synchronous API\n        Pick<A, B> {}\n",
                ),
            ).toBe(
                "interface VirtualFileSystem // Synchronous API\n    extends Pick<A, B> {}\n",
            );
            expect(
                stable("try {\n    a();\n} // C\ncatch {\n    b();\n}\n"),
            ).toBe("try {\n    a();\n} catch {\n    // C\n    b();\n}\n");
            expect(
                stable(
                    'const file = // C\n    long === "." ? "package.json" : `${root}/package.json/and/more/text/here`;\n',
                ),
            ).toBe(
                'const file =\n    // C\n    long === "." ? "package.json" : `${root}/package.json/and/more/text/here`;\n',
            );
        });
    });
});
