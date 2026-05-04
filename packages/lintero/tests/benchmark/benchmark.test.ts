describe("Lintero Benchmark", () => {
    test("object-oriented vs functional implementation", async () => {
        class OoLintero {
            greeting: string;
            constructor() {
                this.greeting = "Hello, linter!";
            }
        }

        function flintero() {
            return "Hello, linter!";
        }

        const startoo = Date.now();
        expect(await new OoLintero().greeting).toMatch("Hello, linter!");
        const endoo = Date.now();
        console.log(
            `Object oriented implementation needed ${Math.round(endoo - startoo)} ms`,
        );
        const startf = Date.now();
        expect(await flintero()).toMatch("Hello, linter!");
        const endf = Date.now();
        console.log(
            `Functional implementation needed ${Math.round(endf - startf)} ms`,
        );
    });
});
