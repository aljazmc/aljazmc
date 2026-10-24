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
