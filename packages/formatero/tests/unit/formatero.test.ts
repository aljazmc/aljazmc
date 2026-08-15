import Formatero from "../../src/formatero";

describe("formatero", () => {
    test("greeting test", () => {
        const received = Formatero.greeting;
        const expected = "Hello, formatter!";
        expect(received).toMatch(expected);
    });
});
