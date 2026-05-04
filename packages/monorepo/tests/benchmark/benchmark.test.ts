describe("Monorepo Benchmark", () => {
    test("object-oriented vs functional implementation", async () => {
        class OoMonorepo {
            greeting: string;
            constructor() {
                this.greeting = "Hello, monorepo!";
            }
        }

        function fmonorepo() {
            return "Hello, monorepo!";
        }

        const startoo = Date.now();
        expect(await new OoMonorepo().greeting).toMatch("Hello, monorepo!");
        const endoo = Date.now();
        console.log(
            `Object oriented implementation needed ${Math.round(endoo - startoo)} ms`,
        );
        const startf = Date.now();
        expect(await fmonorepo()).toMatch("Hello, monorepo!");
        const endf = Date.now();
        console.log(
            `Functional implementation needed ${Math.round(endf - startf)} ms`,
        );
    });
});
