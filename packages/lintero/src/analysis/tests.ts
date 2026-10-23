import type { Node, NodeOf } from "@aljazmc/syntax";

type Call = NodeOf<"CallExpression">;

/** Whether a call declares a suite, like `describe`, or a test, like `it`. */
export type Kind = "describe" | "test";

const bases: Record<string, Kind> = {
    describe: "describe",
    fdescribe: "describe",
    xdescribe: "describe",
    suite: "describe",
    it: "test",
    fit: "test",
    xit: "test",
    test: "test",
    ftest: "test",
    xtest: "test",
    skip: "test",
};

const modifiers: Record<Kind, string[]> = {
    describe: ["only", "skip", "todo", "concurrent", "sequential", "fixme"],
    test: [
        "only",
        "skip",
        "todo",
        "concurrent",
        "sequential",
        "failing",
        "fails",
        "step",
        "fixme",
    ],
};

/** Test framework calls, recognized by their callee like Biome does. */
// biome-ignore lint/complexity/noStaticOnlyClass: groups test call helpers
export default class Tests {
    static readonly hooks = [
        "afterAll",
        "afterEach",
        "beforeAll",
        "beforeEach",
    ];

    /**
     * The kind of a call by its callee, like `test.only(...)`, `describe.each([])(...)`
     * or Playwright's `test.describe.serial(...)`.
     */
    static kind(call: Call): Kind | undefined {
        const { callee } = call;
        // describe.each([...])("title", ...)
        const table = callee.type === "CallExpression";
        const names = Tests.#names(table ? callee.callee : callee);
        if (!names) return;
        if (names.join(".") === "Deno.test") return "test";

        let [first, ...rest] = names;
        let kind = bases[first as string];
        if (!kind) return;
        let allowed = modifiers[kind];
        // Playwright's suites
        if (first === "test" && rest[0] === "describe") {
            kind = "describe";
            allowed = [...modifiers.describe, "serial", "parallel"];
            rest = rest.slice(1);
        }

        const last = rest.at(-1);
        const each = last === "each" || (last === "for" && kind === "test");
        if (table !== each) return;
        const chained = each ? rest.slice(0, -1) : rest;
        if (new Set(rest).size !== rest.length) return;
        if (!chained.every((name) => allowed.includes(name))) return;
        return kind;
    }

    /** Whether a call declares a suite or test with a callback, like `it("works", () => {})`. */
    static declares(call: Call): boolean {
        const [, callback, timeout, ...more] = call.arguments;
        return (
            Tests.kind(call) !== undefined &&
            more.length === 0 &&
            (callback?.type === "ArrowFunctionExpression" ||
                callback?.type === "FunctionExpression") &&
            (!timeout || timeout.type === "NumericLiteral")
        );
    }

    /** The name of a hook call, like `beforeEach(...)`. */
    static hook(call: Call): string | undefined {
        const { callee } = call;
        if (callee.type === "Identifier" && Tests.hooks.includes(callee.name))
            return callee.name;
    }

    /** Names of a callee like `test.describe.only`, also with `["only"]`. */
    static #names(node: Node): string[] | undefined {
        if (node.parenthesized) return;
        if (node.type === "Identifier") return [node.name];
        if (node.type !== "MemberExpression") return;
        const object = Tests.#names(node.object);
        const { property } = node;
        const name = node.computed
            ? property.type === "StringLiteral"
                ? property.raw.slice(1, -1)
                : undefined
            : property.type === "Identifier"
              ? property.name
              : undefined;
        return object && name !== undefined ? [...object, name] : undefined;
    }
}
