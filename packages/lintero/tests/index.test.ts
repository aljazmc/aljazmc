import { Lintero } from "../src/index.ts";

describe("lintero", () => {
    test("greeting test", () => {
        const received = new Lintero();
        const expected = "Hello, linter!";
        expect(received.greeting).toMatch(expected);
    });
});
