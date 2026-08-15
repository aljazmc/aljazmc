import Monorepo from "../../src/monorepo.ts";

describe("monorepo", () => {
    test("greeting test", () => {
        const received = Monorepo.greeting;
        const expected = "Hello, monorepo!";
        expect(received).toMatch(expected);
    });
});
