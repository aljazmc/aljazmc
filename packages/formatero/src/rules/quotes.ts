import type { Javascript, Rule } from "../rules.js";
import type Code from "../tokens/code.js";

export default class Quotes implements Rule {
    readonly #quote: string;
    readonly #jsxQuote: string;

    constructor({
        quoteStyle,
        jsxQuoteStyle,
    }: Pick<Javascript, "quoteStyle" | "jsxQuoteStyle">) {
        this.#quote = quoteStyle === "single" ? "'" : '"';
        this.#jsxQuote = jsxQuoteStyle === "single" ? "'" : '"';
    }

    apply(code: Code): void {
        for (const token of code.tokens) {
            if (token.kind === "string")
                token.value = Quotes.requote(token.value, this.#quote);
            else if (token.kind === "jsxString")
                token.value = Quotes.#swap(token.value, this.#jsxQuote);
        }
    }

    /** Uses the preferred quote unless it needs more escapes. */
    static requote(raw: string, preferred: string): string {
        if (raw.length < 2 || raw.at(-1) !== raw[0]) return raw;

        const other = preferred === '"' ? "'" : '"';
        const chars = raw.slice(1, -1).match(/\\[\s\S]|[\s\S]/g) ?? [];
        const count = (quote: string) =>
            chars.filter((char) => char.at(-1) === quote).length;
        const quote = count(preferred) > count(other) ? other : preferred;
        const alternate = quote === preferred ? other : preferred;

        return (
            quote +
            chars
                .map((char) => {
                    if (char === quote) return `\\${quote}`;
                    return char === `\\${alternate}` ? alternate : char;
                })
                .join("") +
            quote
        );
    }

    /** JSX strings have no escapes, swap only when possible. */
    static #swap(raw: string, quote: string): string {
        const body = raw.slice(1, -1);
        return raw[0] === quote || body.includes(quote)
            ? raw
            : quote + body + quote;
    }
}
