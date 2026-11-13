import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import Config from "@aljazmc/config";
import defaults from "../../src/config.ts";
import Reporter from "../../src/reporter.ts";
import Testero, { type Options } from "../../src/testero.ts";

describe("testero", () => {
    let root: string;

    const write = (file: string, text: string) => {
        mkdirSync(join(root, file, ".."), { recursive: true });
        writeFileSync(join(root, file), text);
    };

    /** Runs testero in the temporary project, returns whether it passed and what it printed. */
    const testero = async (options: Partial<Options> = {}) => {
        const config = await Config.load("testero", defaults, root);
        let output = "";
        const reporter = new Reporter(root, {
            color: false,
            verbose: true,
            write: (text) => {
                output += text;
            },
        });
        const passed = await new Testero(
            config,
            { ...config.rules, patterns: [], ...options },
            reporter,
        ).run();
        return { passed, output };
    };

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "testero-e2e-"));
        write(
            "src/math.ts",
            "export const add = (a: number, b: number): number => a + b;\n",
        );
    });

    afterEach(() => rmSync(root, { recursive: true, force: true }));

    test("compiles TypeScript tests with their imports and reports them", async () => {
        write(
            "tests/math.test.ts",
            [
                'import { add } from "../src/math.ts";',
                "",
                'describe("add", () => {',
                '    test("adds", () => {',
                "        expect(add(1, 2)).toBe(3);",
                "    });",
                '    test.todo("subtracts");',
                "});",
                "",
            ].join("\n"),
        );
        const { passed, output } = await testero();
        expect(passed).toBe(true);
        expect(output).toContain(" PASS  tests/math.test.ts");
        expect(output).toMatch(/ {4}✓ adds/);
        expect(output).toContain("✎ todo subtracts");
        expect(output).toMatch(/Tests: +1 todo, 1 passed, 2 total/);
    });

    test("failures show the message and the code where they happened", async () => {
        write(
            "tests/failing.test.ts",
            [
                'import { add } from "../src/math.ts";',
                "",
                'test("adds wrong", () => {',
                "    const sum: number = add(1, 1);",
                "    expect(sum).toBe(3);",
                "});",
                "",
            ].join("\n"),
        );
        const { passed, output } = await testero();
        expect(passed).toBe(false);
        expect(output).toContain(" FAIL  tests/failing.test.ts");
        expect(output).toContain("● adds wrong");
        expect(output).toContain("Expected: 3\n    Received: 2");
        expect(output).toContain("> 5 |     expect(sum).toBe(3);");
        expect(output).toContain("at tests/failing.test.ts:5:17");
        expect(output).toMatch(/Test Suites: +1 failed, 1 total/);
    });

    test("import.meta describes the source file, keeping lines and columns", async () => {
        write("src/meta.mjs", "export const url = import.meta.url;\n");
        write(
            "tests/meta.test.mjs",
            [
                'import { url } from "../src/meta.mjs";',
                "const dirname = import.meta.dirname;",
                "",
                'test("describes", () => {',
                "    expect(url).toMatch(/\\/src\\/meta\\.mjs$/);",
                '    expect(dirname).toBe(import.meta.filename.replace(/\\/[^/]*$/, ""));',
                "});",
                'test("fails", () => {',
                '    expect(import.meta.url).toBe("x");',
                "});",
                "",
            ].join("\n"),
        );
        const { output } = await testero();
        expect(output).toContain("✓ describes");
        expect(output).toContain(
            `Received: "${pathToFileURL(join(root, "tests/meta.test.mjs")).href}"`,
        );
        expect(output).toContain(
            '>  9 |     expect(import.meta.url).toBe("x");',
        );
        expect(output).toContain("at tests/meta.test.mjs:9:29");
    });

    test("__dirname and __filename describe the source file, of CommonJS too", async () => {
        write(
            "src/paths.cjs",
            "module.exports = { dir: __dirname, file: __filename };\n",
        );
        write(
            "src/own.mjs",
            [
                'import { dirname } from "node:path";',
                'import { fileURLToPath } from "node:url";',
                "const __filename = fileURLToPath(import.meta.url);",
                "const __dirname = dirname(__filename);",
                "export const own = { dir: __dirname, file: __filename };",
                "",
            ].join("\n"),
        );
        write(
            "tests/paths.test.ts",
            [
                'import paths from "../src/paths.cjs";',
                'import { own } from "../src/own.mjs";',
                "",
                'test("describe", () => {',
                "    expect(paths.dir).toMatch(/\\/src$/);",
                "    expect(paths.file).toMatch(/\\/src\\/paths\\.cjs$/);",
                "    expect(own.file).toMatch(/\\/src\\/own\\.mjs$/);",
                "    expect(__filename).toMatch(/\\/tests\\/paths\\.test\\.ts$/);",
                "    expect(__dirname).toBe(import.meta.dirname);",
                "});",
                "",
            ].join("\n"),
        );
        // a script, with no import statements, keeps its lines and columns
        write(
            "tests/script.test.js",
            [
                'test("fails", () => {',
                '    expect(__filename).toBe("x");',
                "});",
                "",
            ].join("\n"),
        );
        const { output } = await testero();
        expect(output).toContain("✓ describe");
        expect(output).toContain(
            `Received: ${JSON.stringify(join(root, "tests/script.test.js"))}`,
        );
        expect(output).toContain('> 2 |     expect(__filename).toBe("x");');
        expect(output).toContain("at tests/script.test.js:2:24");
    });

    test("expect.extend lasts for its own test file only", async () => {
        write(
            "tests/a.test.ts",
            [
                "expect.extend({ toBe: () => ({ pass: true, message: () => '' }) });",
                'test("overrides toBe", () => expect(1).toBe(2));',
                "",
            ].join("\n"),
        );
        write(
            "tests/b.test.ts",
            'test("has its own toBe", () => expect(() => expect(1).toBe(2)).toThrow());\n',
        );
        const { passed, output } = await testero();
        expect(output).toContain("✓ overrides toBe");
        expect(output).toContain("✓ has its own toBe");
        expect(passed).toBe(true);
    });

    test("an error thrown outside of a test fails the test running then", async () => {
        write(
            "tests/timer.test.ts",
            [
                'test("throws in a timer", (done) => {',
                // under Jest, which catches real ones first, the event is emitted
                "    setTimeout(",
                '        () => process.emit("uncaughtException", new Error("from a timer")),',
                "        1,",
                "    );",
                "    void done;",
                "});",
                'test("runs after", () => {});',
                "",
            ].join("\n"),
        );
        const start = performance.now();
        const { passed, output } = await testero();
        expect(performance.now() - start).toBeLessThan(4000);
        expect(passed).toBe(false);
        expect(output).toContain("✕ throws in a timer");
        expect(output).toContain("Error: from a timer");
        expect(output).toContain("✓ runs after");
        expect(output).not.toContain("Test suite failed to run");
    });

    test("import.meta in strings and comments stays as it is", async () => {
        write(
            "tests/strings.test.mjs",
            [
                "// import.meta.url",
                'const text = "import.meta.url";',
                "const url = import.meta.url;",
                "",
                'test("keeps strings", () => {',
                '    expect(text).toBe(["import", "meta", "url"].join("."));',
                "    expect(url).toMatch(/\\/tests\\/strings\\.test\\.mjs$/);",
                "});",
                "",
            ].join("\n"),
        );
        const { passed, output } = await testero();
        expect(output).toContain("✓ keeps strings");
        expect(passed).toBe(true);
    });

    test("globals can be imported like from @jest/globals, mocks included", async () => {
        write(
            "tests/globals.test.js",
            [
                'import { expect, jest, test } from "@jest/globals";',
                "",
                'test("mocks", () => {',
                "    const fn = jest.fn().mockReturnValue(1);",
                "    expect(fn()).toBe(1);",
                "    expect(fn).toHaveBeenCalledTimes(1);",
                "});",
                "",
            ].join("\n"),
        );
        const { passed } = await testero();
        expect(passed).toBe(true);
    });

    test("files that do not compile fail to run", async () => {
        write("tests/broken.test.ts", 'test("a", () => {\n');
        const { passed, output } = await testero();
        expect(passed).toBe(false);
        expect(output).toContain("● Test suite failed to run");
    });

    test("patterns select files, and finding none fails unless allowed", async () => {
        write("tests/a.test.ts", 'test("a", () => {});\n');
        write("tests/b.test.ts", 'test("b", () => {});\n');
        const { output } = await testero({ patterns: ["b\\.test"] });
        expect(output).not.toContain("a.test.ts");
        expect(output).toContain("b.test.ts");

        expect((await testero({ patterns: ["none"] })).passed).toBe(false);
        expect(
            (await testero({ patterns: ["none"], passWithNoTests: true }))
                .passed,
        ).toBe(true);
    });
});
