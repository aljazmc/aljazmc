import Includes from "../../src/includes.ts";

describe("includes", () => {
    test("no globs include no files", () => {
        expect(new Includes([]).matches("src/a.ts")).toBe(false);
    });

    test("** includes every file", () => {
        expect(new Includes(["**"]).matches("src/a/b.ts")).toBe(true);
    });

    test("positive globs select files", () => {
        const includes = new Includes(["src/**/*.ts"]);
        expect(includes.matches("src/a.ts")).toBe(true);
        expect(includes.matches("src/b/c.ts")).toBe(true);
        expect(includes.matches("tests/a.ts")).toBe(false);
    });

    test("negated globs exclude what earlier globs included", () => {
        const includes = new Includes(["**", "!**/*.test.ts"]);
        expect(includes.matches("src/a.ts")).toBe(true);
        expect(includes.matches("src/a.test.ts")).toBe(false);
    });

    test("the last matching glob decides", () => {
        const includes = new Includes([
            "**",
            "!src/generated",
            "src/generated/keep.ts",
        ]);
        expect(includes.matches("src/a.ts")).toBe(true);
        expect(includes.matches("src/generated/b.ts")).toBe(false);
        expect(includes.matches("src/generated/keep.ts")).toBe(true);
    });
});
