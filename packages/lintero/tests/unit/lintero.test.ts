import Config from "@aljazmc/config";
import defaults from "../../src/config.ts";
import { lintFiles } from "../../src/files.ts";
import Lintero from "../../src/lintero.ts";
import type { Rules } from "../../src/rules.ts";
import { biome, organized } from "../biome.ts";

/** The settings, without assist actions unless they are given, like `biome lint`. */
const settings = (rules: object = {}): Rules =>
    Config.merge(
        Config.merge(defaults.rules, { assist: { enabled: false } }),
        rules,
    );

const lint = (source: string, file = "a.ts", rules: object = {}) =>
    new Lintero(settings(rules))
        .lint(source, file)
        .map((d) => `${d.line}:${d.column} ${d.category} ${d.message}`);

/** Only one rule, given as `group/rule`. */
const only = (rule: string, level: unknown = "on") => {
    const [group, name] = rule.split("/") as [string, string];
    return { preset: "none", [group]: { [name]: level } };
};

describe("lintero", () => {
    describe("reports like Biome", () => {
        test.each(biome)(
            "$rule in $file: $source",
            ({ rule, file, options, files = {}, source, expected }) => {
                const turbo = files["turbo.json"];
                const received = new Lintero(
                    settings(only(rule, { level: "on", options })),
                    {},
                    undefined,
                    {
                        ...(turbo && { turbo: JSON.parse(turbo) }),
                        read: (path) => files[path],
                    },
                )
                    .lint(source, file)
                    .map((d) => `${d.line}:${d.column} ${d.message}`);
                expect(received.sort()).toEqual(expected);
            },
        );
    });

    describe("settings", () => {
        test("the recommended preset is the default, nursery and domain rules are not in it", () => {
            const names = new Lintero(settings()).active.map(
                ({ rule }) => rule.name,
            );
            expect(names).toContain("noDebugger");
            expect(names).not.toContain("noFocusedTests");
            expect(
                new Lintero(settings({ preset: "none" })).active,
            ).toHaveLength(0);
            expect(
                new Lintero(settings({ recommended: false })).active,
            ).toHaveLength(0);
        });

        test("groups and rules take a level or a configuration with options", () => {
            expect(lint("debugger;", "a.js", { suspicious: "off" })).toEqual(
                [],
            );
            expect(lint("debugger;", "a.js", { suspicious: "warn" })).toEqual([
                "1:1 lint/suspicious/noDebugger This is an unexpected use of the debugger statement.",
            ]);
            const lintero = new Lintero(
                settings({
                    suspicious: {
                        noDebugger: "info",
                        noDoubleEquals: {
                            level: "on",
                            options: { ignoreNull: false },
                        },
                    },
                }),
            );
            expect(lintero.lint("debugger;", "a.js")[0]?.severity).toBe("info");
            expect(lintero.lint("a == null;", "a.js")).toHaveLength(1);
        });

        test("domains are enabled by dependencies or settings", () => {
            const source = "test.only('a', () => {});";
            const lintero = (rules: object, manifest = {}) =>
                new Lintero(settings(rules), manifest)
                    .lint(source, "a.js")
                    .map((d) => d.category);
            expect(lintero({})).toEqual([]);
            expect(
                lintero({}, { devDependencies: { jest: "^30.5.2" } }),
            ).toEqual(["lint/suspicious/noFocusedTests"]);
            expect(
                lintero({}, { devDependencies: { jest: "^25.0.0" } }),
            ).toEqual([]);
            expect(lintero({ domains: { test: "recommended" } })).toEqual([
                "lint/suspicious/noFocusedTests",
            ]);
            expect(
                lintero(
                    { domains: { test: "none" } },
                    { dependencies: { vitest: "1.0.0" } },
                ),
            ).toEqual([]);
        });

        test("groups take a preset, rules and domains override it", () => {
            const source = "debugger;\ntest.only('a', () => {});\n";
            const lintero = (rules: object) =>
                new Lintero(settings(rules))
                    .lint(source, "a.js")
                    .map((d) => d.category.replace(/^lint\/\w+\//, ""))
                    .sort();
            expect(
                lintero({
                    preset: "none",
                    suspicious: { preset: "recommended" },
                }),
            ).toEqual(["noDebugger"]);
            expect(lintero({ suspicious: { preset: "all" } })).toEqual([
                "noDebugger",
                "noFocusedTests",
            ]);
            expect(lintero({ suspicious: { preset: "none" } })).toEqual([]);
            expect(
                lintero({ preset: "none", suspicious: { recommended: true } }),
            ).toEqual(["noDebugger"]);
            expect(
                lintero({ suspicious: { preset: "none", recommended: true } }),
            ).toEqual([]);
            expect(
                lintero({ suspicious: { preset: "none", noDebugger: "on" } }),
            ).toEqual(["noDebugger"]);
            expect(
                lintero({
                    domains: { test: "none" },
                    suspicious: { preset: "all" },
                }),
            ).toEqual(["noDebugger"]);
            expect(
                lintero({
                    domains: { test: "all" },
                    suspicious: { preset: "none" },
                }),
            ).toEqual(["noFocusedTests"]);
        });

        test("a level for a group leaves domain rules to their domains", () => {
            const source = "debugger;\ntest.only('a', () => {});\n";
            const lintero = (rules: object) =>
                new Lintero(settings(rules))
                    .lint(source, "a.js")
                    .map((d) => `${d.category} ${d.severity}`)
                    .sort();
            expect(lintero({ preset: "all", suspicious: "info" })).toEqual([
                "lint/suspicious/noDebugger info",
            ]);
            expect(
                lintero({
                    domains: { test: "recommended" },
                    suspicious: "info",
                }),
            ).toEqual([
                "lint/suspicious/noDebugger info",
                "lint/suspicious/noFocusedTests info",
            ]);
            expect(
                lintero({ domains: { test: "all" }, suspicious: "off" }),
            ).toEqual([]);
        });

        test("the linter, languages and files can be turned off", () => {
            expect(lint("debugger;", "a.js", { enabled: false })).toEqual([]);
            expect(
                lint("debugger;", "a.js", { javascript: { enabled: false } }),
            ).toEqual([]);
            expect(
                lint('{ "a": 1, "a": 2 }', "a.json", {
                    json: { enabled: false },
                }),
            ).toEqual([]);
            expect(
                lint("debugger;", "src/a.js", { includes: ["lib/**"] }),
            ).toEqual([]);
            expect(
                lint("debugger;", "src/a.js", { includes: ["**", "!src"] }),
            ).toEqual([]);
            expect(lint("debugger;", "a.md")).toEqual([]);
        });
    });

    describe("scopes", () => {
        // the expected diagnostics leave out rules lintero does not implement
        test("types and values, declarations and their uses are told apart", () => {
            const source = [
                'import type { Shape } from "./shape";',
                'import { area, unused } from "./area";',
                "export enum Kind { Circle = 1, Square = Circle + 1 }",
                "export namespace Shapes { export const all: Shape[] = []; const hidden = 1; }",
                "type Pair<T, U> = [T, U];",
                "interface Box<T> extends Pair<T, T> { value: T; [key: string]: unknown }",
                "export class Store<T> implements Box<T> {",
                "    #items = new Map<string, T>();",
                "    static create<V>(this: void): Store<V> { return new Store<V>(); }",
                "    constructor(private readonly name: string, public value: T) {}",
                "    get size(): number { return this.#items.size; }",
                "    *[Symbol.iterator]() { yield* this.#items.values(); }",
                "    find(predicate: (item: T, index: number) => boolean): T | undefined {",
                "        for (const [key, item] of this.#items) if (predicate(item, Number(key))) return item;",
                "    }",
                "}",
                "export function measure<S extends Shape>({ kind, ...rest }: S, scale = 1): number {",
                "    let total = 0;",
                "    total += area(rest) * scale;",
                "    const label = `${kind}`;",
                '    return typeof label === "string" ? total : 0;',
                "}",
                "declare global { interface Window { store: Store<number> } }",
                "type Keys<T> = { [K in keyof T]: T[K] extends infer V ? V : never };",
                "export type { Keys };",
            ].join("\n");
            expect(lint(source)).toEqual([
                "2:16 lint/correctness/noUnusedImports Several of these imports are unused.",
                "4:65 lint/correctness/noUnusedVariables This variable hidden is unused.",
            ]);
        });

        test("assignments, updates and redeclarations are tracked", () => {
            const source = [
                "const a = 1;",
                "a = 2;",
                "let b = 0;",
                "b++;",
                "var c = 1;",
                "var c = 2;",
                "function f(d) { var d = 3; return d; }",
                "class E {}",
                "E = null;",
                "try { f(c); } catch (error) { error = 1; }",
                "label: for (;;) { break label; }",
            ].join("\n");
            expect(lint(source, "a.js")).toEqual([
                "1:7 lint/correctness/noUnusedVariables This variable a is unused.",
                "2:1 lint/correctness/noConstAssign Can't assign a because it's a constant.",
                "3:5 lint/correctness/noUnusedVariables This variable b is unused.",
                "5:5 lint/correctness/noUnusedVariables This variable c is unused.",
                "6:5 lint/suspicious/noRedeclare 'c' is redeclared in the same scope.",
                "7:12 lint/correctness/noUnusedFunctionParameters This parameter d is unused.",
                "7:21 lint/suspicious/noRedeclare 'd' is redeclared in the same scope.",
                "8:7 lint/correctness/noUnusedVariables This class E is unused.",
                "9:1 lint/suspicious/noClassAssign The class 'E' is reassigned.",
                "10:22 lint/correctness/noUnusedVariables This variable error is unused.",
                "10:31 lint/suspicious/noCatchAssign Reassigning a catch parameter is confusing.",
                "11:25 lint/complexity/noUselessLabel Unnecessary label.",
            ]);
        });
    });

    describe("files", () => {
        test("JSON objects have no duplicate keys", () => {
            expect(
                lint('{ "a": 1, "b": { "a": 2 }, "a": 3 }', "a.json"),
            ).toEqual([
                "1:3 lint/suspicious/noDuplicateObjectKeys The key a was already declared.",
            ]);
        });

        test("syntax errors are reported", () => {
            expect(lint("const = ;")).toEqual([
                expect.stringMatching(/^1:7 parse /),
            ]);
        });

        test("CSS is linted unless disabled, like Biome the rest of a file with errors too", () => {
            const source = "a { color: red; color: blue; }\nb { color: }\n";
            // the declaration with an error is skipped, the block is not empty
            expect(lint(source, "a.css")).toEqual([
                "1:17 lint/suspicious/noDuplicateProperties Duplicate properties can lead to unexpected behavior and may override previous declarations unintentionally.",
                expect.stringMatching(/^2:11 parse /),
            ]);
            expect(lint(source, "a.css", { css: { enabled: false } })).toEqual(
                [],
            );
            // styles in HTML are linted as CSS, style attributes not
            expect(
                lint(
                    '<html lang="en"><head><style>\na { color: red; color: blue; }\n</style></head><body><p style="color: red; color: blue">x</p></body></html>\n',
                    "a.html",
                ),
            ).toEqual([
                "2:17 lint/suspicious/noDuplicateProperties Duplicate properties can lead to unexpected behavior and may override previous declarations unintentionally.",
            ]);
            // suppression comments work in CSS comments too
            expect(
                lint(
                    "a {\n  /* biome-ignore lint/suspicious/noDuplicateProperties: on purpose */\n  color: red; color: blue;\n}\n",
                    "a.css",
                ),
            ).toEqual([]);
        });

        test("JavaScript is a module unless package.json makes it CommonJS", () => {
            const source =
                '"use strict";\nfunction foo() {\n\t"use strict";\n}\n';
            const lint = (file: string, manifest = {}) =>
                new Lintero(
                    settings(only("suspicious/noRedundantUseStrict")),
                    manifest,
                )
                    .lint(source, file)
                    .map((d) => `${d.line}:${d.column}`);
            expect(lint("a.js")).toEqual(["1:1", "3:2"]);
            expect(lint("a.js", { type: "commonjs" })).toEqual(["3:2"]);
            expect(lint("a.mjs", { type: "commonjs" })).toEqual(["1:1", "3:2"]);
            expect(lint("a.ts", { type: "commonjs" })).toEqual(["1:1", "3:2"]);
            expect(new Lintero(settings()).fix(source, "a.js")).toBe(
                "\nfunction foo() {\n\t\n}\n",
            );
        });

        test("HTML files are linted unless html.enabled is false", () => {
            const source = '<html><body><img src="a.png"></body></html>\n';
            expect(lint(source, "a.html")).toEqual([
                "1:1 lint/a11y/useHtmlLang Provide a lang attribute when using the html element.",
                "1:13 lint/a11y/useAltText Provide a text alternative through the alt, aria-label, or aria-labelledby attribute.",
            ]);
            expect(lint(source, "a.htm")).toHaveLength(2);
            expect(
                lint(source, "a.html", { html: { enabled: false } }),
            ).toEqual([]);
            expect(lint("<div><span></div>\n", "a.html")).toEqual([
                "1:12 parse Expected a matching closing tag but instead found '</div>'.",
            ]);
        });

        test("scripts in HTML are linted like files of their language, at their place", () => {
            const source =
                '<div>\n<script>\nvar a = 1;\ndebugger;\n</script>\n<script type="module">\nimport b from "b";\nconst c = 1;\nfunction d() {}\n</script>\n<script type="application/json">{"e": 1, "e": 2}</script>\n<script type="text/template"><a onclick="x"></a></script>\n<!-- biome-ignore lint/suspicious/noDebugger: test -->\n<script>debugger;</script>\n<script>\n// biome-ignore lint/suspicious/noDebugger: test\ndebugger;\n</script>\n</div>\n';
            // the top level imports and variables of module scripts may be used by the page
            expect(lint(source, "a.html")).toEqual([
                "3:5 lint/correctness/noUnusedVariables This variable a is unused.",
                "4:1 lint/suspicious/noDebugger This is an unexpected use of the debugger statement.",
                "9:10 lint/correctness/noUnusedVariables This function d is unused.",
                "11:34 lint/suspicious/noDuplicateObjectKeys The key e was already declared.",
            ]);
            const fixed = new Lintero(settings()).fix(
                "<script>\ndebugger;\nlet  x = 1;\nconsole.log(x);\n</script>\n",
                "a.html",
            );
            // removing the debugger statement is unsafe
            expect(fixed).toBe(
                "<script>\ndebugger;\nconst  x = 1;\nconsole.log(x);\n</script>\n",
            );
        });

        test("Markdown files are linted unless markdown.enabled is false", () => {
            const rules = {
                suspicious: { noEmptySource: "on" },
                nursery: { useTopLevelHeading: "on" },
            };
            expect(new Lintero(settings()).lints("README.md")).toBe(true);
            expect(lint("", "a.md", rules)).toEqual([
                "1:1 lint/suspicious/noEmptySource An empty source is not allowed.",
            ]);
            expect(lint("text\n", "a.markdown", rules)).toEqual([
                "1:1 lint/nursery/useTopLevelHeading Missing top-level heading.",
            ]);
            const disabled = { ...rules, markdown: { enabled: false } };
            expect(new Lintero(settings(disabled)).lints("a.md")).toBe(false);
            expect(lint("text\n", "a.md", disabled)).toEqual([]);
            // JavaScript rules do not run on Markdown, nor Markdown rules on JavaScript
            expect(lint("debugger;\n", "a.md")).toEqual([]);
            expect(
                lint("", "a.js", { nursery: { useTopLevelHeading: "on" } }),
            ).toEqual([]);
        });
    });

    describe("suppressions", () => {
        test("HTML comments suppress diagnostics in Markdown", () => {
            const rules = { nursery: { useConsistentHeadingLevel: "on" } };
            expect(
                lint(
                    "# A\n\n<!-- biome-ignore lint/nursery/useConsistentHeadingLevel: on purpose -->\n### C\n\nText <!-- lintero-ignore lint/nursery: inline --> more\n#### D\n\n<!-- biome-ignore lint/style/useConst: other -->\n\n###### F\n\n<!-- biome-ignore lint/foo -->\n",
                    "a.md",
                    rules,
                ),
            ).toEqual([
                "9:1 suppressions/unused Suppression comment has no effect. Remove the suppression or make sure you are suppressing the correct rule.",
                "11:1 lint/nursery/useConsistentHeadingLevel This heading skipped a level.",
                '13:19 suppressions/parse Failed to parse category "lint/foo". Example of suppression: // lintero-ignore lint: reason',
            ]);
        });

        test("a comment suppresses rules on the line of the next token", () => {
            expect(
                lint(
                    "// biome-ignore lint/suspicious/noDebugger: testing\ndebugger;",
                    "a.js",
                ),
            ).toEqual([]);
            expect(
                lint(
                    "// biome-ignore lint/suspicious: testing\ndebugger;",
                    "a.js",
                ),
            ).toEqual([]);
            expect(
                lint("// lintero-ignore lint: testing\ndebugger;", "a.js"),
            ).toEqual([]);
            // a trailing comment suppresses the following line
            expect(
                lint(
                    "debugger; // biome-ignore lint: testing\nlet a = 1;",
                    "a.js",
                ),
            ).toEqual([
                "1:1 lint/suspicious/noDebugger This is an unexpected use of the debugger statement.",
            ]);
        });

        test("whole files and ranges are suppressed", () => {
            expect(
                lint(
                    "// biome-ignore-all lint/suspicious/noDebugger: testing\ndebugger;\ndebugger;",
                    "a.js",
                ),
            ).toEqual([]);
            expect(
                lint(
                    "// biome-ignore-start lint/suspicious/noDebugger: testing\ndebugger;\n// biome-ignore-end lint/suspicious/noDebugger: testing\ndebugger;",
                    "a.js",
                ),
            ).toEqual([
                "4:1 lint/suspicious/noDebugger This is an unexpected use of the debugger statement.",
            ]);
        });

        test("unused and malformed suppressions are reported", () => {
            expect(
                lint(
                    "// biome-ignore lint/suspicious/noDebugger: testing\nfoo();",
                    "a.js",
                ),
            ).toEqual([
                "1:1 suppressions/unused Suppression comment has no effect. Remove the suppression or make sure you are suppressing the correct rule.",
            ]);
            expect(
                lint(
                    "// biome-ignore lint/suspicious/noDebugger\ndebugger;",
                    "a.js",
                ),
            ).toEqual([
                "1:17 suppressions/parse Unexpected token, expected one of ':', '(' or whitespace. Example of suppression: // lintero-ignore lint: reason",
                "2:1 lint/suspicious/noDebugger This is an unexpected use of the debugger statement.",
            ]);
            expect(
                lint("// biome-ignore lint/suspicous: testing\nfoo();", "a.js"),
            ).toEqual([
                expect.stringContaining(
                    'suppressions/parse Failed to parse category "lint/suspicous".',
                ),
            ]);
        });
    });

    describe("fixes", () => {
        test("Markdown fixes, like the byte order mark", () => {
            const rules = (bom: string) => ({
                preset: "none",
                nursery: {
                    useConsistentUnicodeBom: { level: "on", options: { bom } },
                },
            });
            const fix = (source: string, bom: string) =>
                new Lintero(settings(rules(bom))).fix(source, "a.md");
            expect(fix("\uFEFF# A\n", "never")).toBe("# A\n");
            expect(fix("# A\n", "always")).toBe("\uFEFF# A\n");
            expect(fix("# A\n", "never")).toBe("# A\n");
        });

        test("safe fixes apply with write, unsafe ones only when asked", () => {
            const lintero = new Lintero(settings());
            const source = "let a = 1;\nif (a == 2) debugger;\n";
            expect(lintero.fix(source, "a.js")).toBe(
                "const a = 1;\nif (a == 2) debugger;\n",
            );
            expect(lintero.fix(source, "a.js", true)).toBe(
                "const a = 1;\nif (a === 2) {}\n",
            );
        });

        test("useLogicalProperties splits physical shorthands and combines logical longhands like Biome", () => {
            const lintero = new Lintero(
                settings(only("nursery/useLogicalProperties")),
            );
            const source =
                "p { margin: 1px 2px; }\np { padding: 1px 2px 3px; }\np { inset: 1px 2px 3px 4px; }\np { margin: 1px 2px 1px 2px; }\np { margin: 1px; }\np { margin: var(--a) 2px; }\np { margin: calc(var(--a) * 2) 2px; }\np { margin: inherit 2px; }\np { margin: default 2px; }\np { margin: 1px 2px !important; }\np { border-color: red blue; scroll-margin: 1px 2px; scroll-padding: 1px 2px; border-width: 1px 2px; border-style: solid none }\np { margin: 1px 2px 3px 4px 5px; }\np { margin-block-start: 1px; margin-block-end: 2px; }\np { margin-block-end: 2px; margin-block-start: 1px; }\np { margin-block-start: 1px; color: red; margin-block-end: 1px; }\np { margin-block-start: 1px; margin: 0; margin-block-end: 1px; }\np { margin-block-start: 1px; margin-top: 0; margin-block-end: 1px; }\np { margin-block-start: 1px; margin-left: 0; margin-block-end: 1px; }\np { margin-block-start: 1px; all: unset; margin-block-end: 1px; }\np { margin-block-start: 1px; a { color: red } margin-block-end: 1px; }\np { margin-block-start: 1px; margin-block-end: 1px !important; }\np { margin-block-start: 1px; margin-block-end: 1px; margin-block-end: 2px; }\np { border-block-start: 1px solid; border-block-end: 2px solid; }\np { border-block-start: 1px solid; border-block-end: 1px solid; }\np { margin-block-start: 1px /* c */; margin-block-end: 1px; }\np { margin-block-start: var(--x); margin-block-end: 1px; }\np { margin-block-start: inherit; margin-block-end: 1px; }\np { margin-inline-start: 1px; border-inline-start-width: 2px; margin-inline-end: 1px; }\np { border-block-start-width: 1px; border-block-start: 0; border-block-end-width: 1px; }\np { MARGIN-BLOCK-START: 1px; margin-block-end: 2px; }\np { margin: 1px, 2px; }\np {\n  margin-block-start: 1px;\n  margin-block-end: 2px;\n}\np {\n  margin: 1px 2px\n}\np {\n  margin-inline-start: 1px !important;\n  color: red;\n  margin-inline-end: 1px !important;\n}\n";
            let fixed = source;
            for (let pass = 0; pass < 5; pass++)
                fixed = lintero.fix(fixed, "a.css", true);
            expect(fixed).toBe(
                "p { margin-block: 1px; margin-inline: 2px; }\np { padding-block: 1px 3px; padding-inline: 2px; }\np { inset-block: 1px 3px; inset-inline: 4px 2px; }\np { margin-block: 1px; margin-inline: 2px; }\np { margin: 1px; }\np { margin: var(--a) 2px; }\np { margin: calc(var(--a) * 2) 2px; }\np { margin: inherit 2px; }\np { margin-block: default; margin-inline: 2px; }\np { margin-block: 1px !important; margin-inline: 2px !important; }\np { border-block-color: red; border-inline-color: blue; scroll-margin-block: 1px; scroll-margin-inline: 2px; scroll-padding-block: 1px; scroll-padding-inline: 2px; border-block-width: 1px; border-inline-width: 2px; border-block-style: solid; border-inline-style: none }\np { margin: 1px 2px 3px 4px 5px; }\np { margin-block: 1px 2px; }\np { margin-block: 1px 2px; }\np { margin-block: 1px; color: red; }\np { margin-block-start: 1px; margin: 0; margin-block-end: 1px; }\np { margin-block-start: 1px; margin-block-start: 0; margin-block-end: 1px; }\np { margin-block: 1px; margin-inline-start: 0; }\np { margin-block-start: 1px; all: unset; margin-block-end: 1px; }\np { margin-block-start: 1px; a { color: red } margin-block-end: 1px; }\np { margin-block-start: 1px; margin-block-end: 1px !important; }\np { margin-block-start: 1px; margin-block-end: 1px; margin-block-end: 2px; }\np { border-block-start: 1px solid; border-block-end: 2px solid; }\np { border-block: 1px solid; }\np { margin-block-start: 1px /* c */; margin-block-end: 1px; }\np { margin-block-start: var(--x); margin-block-end: 1px; }\np { margin-block-start: inherit; margin-block-end: 1px; }\np { margin-inline: 1px; border-inline-start-width: 2px; }\np { border-block-start-width: 1px; border-block-start: 0; border-block-end-width: 1px; }\np { margin-block: 1px 2px; }\np { margin-block: 1px 2px; margin-inline: ,; }\np {\n  margin-block: 1px 2px;\n}\np {\n  margin-block: 1px; margin-inline: 2px\n}\np {\n  margin-inline: 1px !important;\n  color: red;\n}\n",
            );
        });

        test("a rule's fix can be turned off", () => {
            const lintero = new Lintero(
                settings({ style: { useConst: { level: "on", fix: "none" } } }),
            );
            expect(lintero.fix("let a = 1;\nfoo(a);\n", "a.js")).toBe(
                "let a = 1;\nfoo(a);\n",
            );
        });

        test("fixes keep the code valid", () => {
            const lintero = new Lintero(settings());
            expect(
                lintero.fix(
                    'import { foo as foo } from "fs";\nfoo();\n',
                    "a.js",
                    true,
                ),
            ).toBe('import { foo } from "node:fs";\nfoo();\n');
            expect(lintero.fix("const x = !!a ? 1 : 2;\n", "a.js")).toBe(
                "const x = a ? 1 : 2;\n",
            );
            expect(
                lintero.fix('a["b"] = c?.["d"] + e[ "f" ];\n', "a.js", true),
            ).toBe("a.b = c?.d + e.f;\n");
        });
    });

    describe("organizeImports", () => {
        // the action alone, without the rules
        const assist = { preset: "none", assist: { enabled: true } };
        const organize = (source: string, rules: object = {}) =>
            new Lintero(settings({ ...assist, ...rules })).fix(source, "a.ts");

        test.each(organized)("$name", ({ source, expected }) => {
            const lintero = new Lintero(settings(assist));
            const diagnostics = lintero
                .lint(source, "a.ts")
                .filter(({ category }) => category.startsWith("assist"));
            expect(diagnostics).toHaveLength(source === expected ? 0 : 1);
            expect(organize(source)).toBe(expected);
            expect(organize(expected)).toBe(expected);
        });

        test("reports unsorted chunks where they start, as errors with a safe fix", () => {
            expect(
                lint(
                    'foo();\n\nimport B from "b";\nimport A from "a";\n',
                    "a.ts",
                    assist,
                ),
            ).toEqual([
                "3:1 assist/source/organizeImports Sort these imports.",
            ]);
            expect(
                lint(
                    'export * from "b";\nexport * from "a";\n',
                    "a.ts",
                    assist,
                ),
            ).toEqual([
                "1:1 assist/source/organizeImports Sort these exports.",
            ]);
            const [diagnostic] = new Lintero(settings(assist)).lint(
                'import B from "b";\nimport A from "a";\n',
                "a.ts",
            );
            expect(diagnostic?.severity).toBe("error");
            expect(diagnostic?.fix?.kind).toBe("safe");
        });

        test("is on by default, and off with assist or the action off", () => {
            const source = 'import B from "b";\nimport A from "a";\n';
            const all = (rules: Rules) =>
                new Lintero(rules).lint(source, "a.ts").length;
            expect(all(Config.merge(defaults.rules, { preset: "none" }))).toBe(
                1,
            );
            expect(all(settings(assist))).toBe(1);
            expect(
                all(
                    settings({
                        ...assist,
                        assist: {
                            enabled: true,
                            actions: { source: { organizeImports: "off" } },
                        },
                    }),
                ),
            ).toBe(0);
            expect(
                lint(source, "a.ts", {
                    preset: "none",
                    assist: {
                        enabled: true,
                        actions: { source: { organizeImports: "warn" } },
                    },
                }),
            ).toEqual([
                "1:1 assist/source/organizeImports Sort these imports.",
            ]);
            // only modules, not JSON
            expect(lint("[1]\n", "a.json", assist)).toEqual([]);
        });

        test("identifierOrder and sortBareImports", () => {
            const options = (options: object) => ({
                preset: "none",
                assist: {
                    enabled: true,
                    actions: {
                        source: {
                            organizeImports: { level: "on", options },
                        },
                    },
                },
            });
            expect(
                organize(
                    'import { a10, a9, B, a } from "x";\n',
                    options({ identifierOrder: "lexicographic" }),
                ),
            ).toBe('import { B, a, a10, a9 } from "x";\n');
            expect(
                organize(
                    'import "b";\nimport A from "a";\n',
                    options({ sortBareImports: true }),
                ),
            ).toBe('import A from "a";\nimport "b";\n');
            expect(organize('import "b";\nimport A from "a";\n')).toBe(
                'import "b";\nimport A from "a";\n',
            );
        });

        test("suppressions, which are unused when nothing is to sort", () => {
            const source =
                '// biome-ignore assist/source/organizeImports: kept\nimport B from "b";\nimport A from "a";\n';
            expect(lint(source, "a.ts", assist)).toEqual([]);
            expect(
                lint(
                    '// lintero-ignore assist/source/organizeImports: kept\nimport A from "a";\n',
                    "a.ts",
                    assist,
                ),
            ).toEqual([
                "1:1 suppressions/unused Suppression comment has no effect. Remove the suppression or make sure you are suppressing the correct rule.",
            ]);
        });

        test("comments of merged imports are kept, which Biome drops", () => {
            expect(
                organize(
                    'import { b } from "x"; // b\n// a\nimport { a } from "x"; // after a\n',
                ),
            ).toBe('// a\nimport { a, b } from "x"; // b // after a\n');
        });

        test("comments outside braces keep a statement as it is", () => {
            const source = 'import /* d */ D, { b, a } from "x";\n';
            expect(organize(source)).toBe(source);
        });
    });

    describe("regressions", () => {
        test("names that Object.prototype has are names like any other", () => {
            const all = settings({
                preset: "all",
                nursery: "on",
                domains: { react: "all", test: "all", qwik: "all" },
            });
            const lintero = new Lintero(all);
            const templates: [string, string][] = [
                ["a.ts", "N.call(a);\nN.only('x', () => {});\nReact.N(a);\n"],
                ["a.tsx", 'x = <div role="N" aria-N="true" />;\n'],
                ["a.html", '<div role="N" N="a" aria-N="x" align="y"></div>\n'],
                ["a.css", "a { N: red; width: 1N; color: N(1); }\n"],
            ];
            // `__proto__` and `hasOwnProperty` have rules of their own
            for (const name of ["constructor", "toString", "valueOf"])
                for (const [file, template] of templates) {
                    // columns move with the length of the name, lines and rules not
                    const categories = (text: string) =>
                        lintero
                            .lint(text, file)
                            .map((d) => `${d.line} ${d.category}`);
                    expect(categories(template.replaceAll("N", name))).toEqual(
                        categories(template.replaceAll("N", "zzqq")),
                    );
                }
        });

        test("a file that fails stops no other, and counts as an error", () => {
            const log: string[] = [];
            const lintero = new Lintero(settings());
            const counts = lintFiles(
                [
                    { file: "a.js", path: "/a.js", text: "debugger;\n" },
                    { file: "b.js", path: "/b.js", text: "debugger;\n" },
                    { file: "c.js", path: "/c.js", text: "debugger;\n" },
                ],
                (file) => {
                    if (file === "b.js") throw new TypeError("a bug");
                    return lintero;
                },
                { log: (line) => log.push(line) },
            );
            expect(counts).toEqual({ error: 3, warn: 0, info: 0 });
            expect(log[0]).toMatch(
                /^error: a\.js:1:1 lint\/suspicious\/noDebugger/,
            );
            expect(log[1]).toMatch(
                /^error: b\.js: lintero failed, please report it: TypeError: a bug/,
            );
            expect(log[2]).toMatch(
                /^error: c\.js:1:1 lint\/suspicious\/noDebugger/,
            );
        });
    });
});
