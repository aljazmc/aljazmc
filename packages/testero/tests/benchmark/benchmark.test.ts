describe("Testero Benchmark", () => {
    test("object-oriented vs functional implementation", async () => {
        class OoTestero {
            greeting: string;
            constructor() {
                this.greeting = "Hello, test runner!";
            }
        }

        function ftestero() {
            return "Hello, test runner!";
        }

        const startoo = Date.now();
        expect(await new OoTestero().greeting).toMatch("Hello, test runner!");
        const endoo = Date.now();
        console.log(
            `Object oriented implementation needed ${Math.round(endoo - startoo)} ms`,
        );
        const startf = Date.now();
        expect(await ftestero()).toMatch("Hello, test runner!");
        const endf = Date.now();
        console.log(
            `Functional implementation needed ${Math.round(endf - startf)} ms`,
        );
    });
});
