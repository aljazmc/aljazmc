import { Formatero } from "../src/index.ts";

describe("formatero", () => {
    test("greeting test", () => {
        const received = new Formatero();
        const expected = "Hello, formatter!";
        expect(received.greeting).toMatch(expected);
    });
});
