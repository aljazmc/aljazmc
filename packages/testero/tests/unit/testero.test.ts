import Testero from "../../src/testero.ts";

describe("testero", () => {
    test("greeting test", () => {
        const received = Testero.greeting;
        const expected = "Hello, test runner!";
        expect(received).toMatch(expected);
    });
});
