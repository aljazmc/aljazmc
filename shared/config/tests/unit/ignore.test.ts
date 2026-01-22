import Ignore from "../../src/ignore.ts";

describe("ignore", () => {
    test("name matches files and directories at any depth", () => {
        const ignore = new Ignore(["node_modules", "README.md"]);
        expect(ignore.matches("node_modules")).toBe(true);
        expect(ignore.matches("a/node_modules/b.js")).toBe(true);
        expect(ignore.matches("packages/x/README.md")).toBe(true);
        expect(ignore.matches("src/readme.ts")).toBe(false);
    });

    test("path is anchored to root and covers its contents", () => {
        const ignore = new Ignore(["packages/testero/tests"]);
        expect(ignore.matches("packages/testero/tests")).toBe(true);
        expect(ignore.matches("packages/testero/tests/unit/a.ts")).toBe(true);
        expect(ignore.matches("x/packages/testero/tests")).toBe(false);
        expect(ignore.matches("packages/lintero/tests")).toBe(false);
    });

    test("globs", () => {
        const ignore = new Ignore(["*.log", "packages/*/bin", "**/tmp/?.ts"]);
        expect(ignore.matches("a/b/error.log")).toBe(true);
        expect(ignore.matches("packages/lintero/bin/main.js")).toBe(true);
        expect(ignore.matches("packages/a/b/bin")).toBe(false);
        expect(ignore.matches("tmp/a.ts")).toBe(true);
        expect(ignore.matches("x/y/tmp/b.ts")).toBe(true);
        expect(ignore.matches("x/tmp/ab.ts")).toBe(false);
    });

    test("leading ./ and trailing / are ignored, dots are literal", () => {
        const ignore = new Ignore(["./dist/", "a.b"]);
        expect(ignore.matches("dist/x.js")).toBe(true);
        expect(ignore.matches("./dist")).toBe(true);
        expect(ignore.matches("axb")).toBe(false);
    });

    test("braces list alternatives", () => {
        const ignore = new Ignore(["*.{test,spec}.{ts,js}", "{a,b}/c"]);
        expect(ignore.matches("x/a.test.ts")).toBe(true);
        expect(ignore.matches("a.spec.js")).toBe(true);
        expect(ignore.matches("a.unit.ts")).toBe(false);
        expect(ignore.matches("b/c")).toBe(true);
        expect(ignore.matches("d/c")).toBe(false);
    });
});
