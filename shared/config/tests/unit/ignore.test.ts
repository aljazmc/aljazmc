import Ignore from "../../src/ignore.ts";
import Includes from "../../src/includes.ts";

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

    test("a leading / or ./ anchors to the root, dots are literal", () => {
        const ignore = new Ignore(["/build", "./dist", "a.b"]);
        expect(ignore.matches("build")).toBe(true);
        expect(ignore.matches("build/x.js")).toBe(true);
        expect(ignore.matches("src/build/x.js")).toBe(false);
        expect(ignore.matches("./dist/x.js")).toBe(true);
        expect(ignore.matches("src/dist")).toBe(false);
        expect(ignore.matches("axb")).toBe(false);
    });

    test("a trailing / matches folders only, and their contents", () => {
        const ignore = new Ignore(["build/", "out/gen/"]);
        expect(ignore.matches("build", true)).toBe(true);
        expect(ignore.matches("build")).toBe(false);
        expect(ignore.matches("src/build", true)).toBe(true);
        expect(ignore.matches("src/build/x.js")).toBe(true);
        expect(ignore.matches("out/gen", true)).toBe(true);
        expect(ignore.matches("out/gen")).toBe(false);
        expect(ignore.matches("out/gen/x.js")).toBe(true);
    });

    test("an unclosed brace is an error that names the setting and the glob", () => {
        expect(() => new Ignore(["{a,b"])).toThrow(
            'Invalid ignore "{a,b": a { is not closed by a }.',
        );
        expect(() => new Includes(["src/{a,b"], "testMatch")).toThrow(
            'Invalid testMatch "src/{a,b": a { is not closed by a }.',
        );
        expect(() => new Includes(["src/{a,b}"])).not.toThrow();
        // a } without a { is a character like any other
        expect(new Ignore(["a}"]).matches("a}")).toBe(true);
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
