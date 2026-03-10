import { Testero } from "../src/index.ts";

describe("testero", () => {
    test("greeting test", () => {
        const received = new Testero();
        const expected = "Hello, test runner!";
        expect(received.greeting).toMatch(expected);
    });
});
