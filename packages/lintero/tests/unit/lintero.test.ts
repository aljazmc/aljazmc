import Lintero from "../../src/lintero.ts";

describe("lintero", () => {
    test("greeting test", () => {
        const received = Lintero.greeting;
        const expected = "Hello, linter!";
        expect(received).toMatch(expected);
    });
});
