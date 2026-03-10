import { Monorepo } from "../src/index.ts";

describe("monorepo", () => {
    test("greeting test", () => {
        const received = new Monorepo();
        const expected = "Hello, monorepo!";
        expect(received.greeting).toMatch(expected);
    });
});
