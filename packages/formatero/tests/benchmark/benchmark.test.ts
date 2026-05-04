describe("Formatero Benchmark", () => {
    test("object-oriented vs functional implementation", async () => {
        class OoFormatero {
            greeting: string;
            constructor() {
                this.greeting = "Hello, formatter!";
            }
        }

        function fformatero() {
            return "Hello, formatter!";
        }

        const startoo = Date.now();
        expect(await new OoFormatero().greeting).toMatch("Hello, formatter!");
        const endoo = Date.now();
        console.log(
            `Object oriented implementation needed ${Math.round(endoo - startoo)} ms`,
        );
        const startf = Date.now();
        expect(await fformatero()).toMatch("Hello, formatter!");
        const endf = Date.now();
        console.log(
            `Functional implementation needed ${Math.round(endf - startf)} ms`,
        );
    });
});
