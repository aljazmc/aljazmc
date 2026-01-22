import { describe, expect, test } from "@jest/globals";
import {
    language,
    ParseError,
    parse,
    parseExpression,
} from "../../src/index.ts";

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
    });

    test("the parser accepts modern syntax", () => {
        const source =
            "@decorator class A<const T> { static { } accessor #x = 1n; }\nusing r = get();\nconst t = obj?.a?.[b]?.(c) satisfies T;";
        expect(
            parse(source, { typescript: true, jsx: false }).program.body,
        ).toHaveLength(3);
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
});
