import type { Javascript, Rule } from "../rules.js";
import type Code from "../tokens/code.js";
import Lexer from "../tokens/lexer.js";
import type { Token } from "../tokens/token.js";

/**
 * Spaces inside braces (bracketSpacing), and inside parens, brackets,
 * type arguments, template interpolations and after `!` (delimiterSpacing).
 */
export default class Spacing implements Rule {
    readonly #bracketSpacing: boolean;
    readonly #delimiterSpacing: boolean;

    constructor({
        bracketSpacing,
        delimiterSpacing,
    }: Pick<Javascript, "bracketSpacing" | "delimiterSpacing">) {
        this.#bracketSpacing = bracketSpacing;
        this.#delimiterSpacing = delimiterSpacing;
    }

    apply(code: Code): void {
        const pairs: [Token, Token][] = [];
        const negations: Token[] = [];

        for (const [index, token] of code.tokens.entries()) {
            if (token.open) pairs.push([token.open, token]);
            if (this.#negation(code, index)) negations.push(token);
            if (token.kind === "template")
                token.value = this.#template(token.value);

            const close = this.#generic(code, index);
            if (close) pairs.push([token, close]);
        }

        for (const [open, close] of pairs) this.#pair(code, open, close);
        for (const negation of negations)
            this.#space(
                code,
                code.tokens.indexOf(negation),
                this.#delimiterSpacing,
            );
    }

    /** Whether the token at index is a prefix `!`, spaced like a delimiter. */
    #negation(code: Code, index: number): boolean {
        const token = code.tokens[index];
        const before = code.tokens[code.seek(index, -1)];

        return (
            token?.kind === "punct" &&
            token.value === "!" &&
            !(
                before?.kind === "word" ||
                [")", "]"].includes(before?.value ?? "")
            )
        );
    }

    #pair(code: Code, openToken: Token, closeToken: Token): void {
        const { tokens } = code;
        const spacing = this.#spacing(openToken);
        if (spacing === undefined) return;

        const close = tokens.indexOf(closeToken);
        const open = tokens.lastIndexOf(openToken, close);
        if (code.seek(open, 1) === close) {
            if (open + 1 < close) this.#space(code, open, false);
            return;
        }

        const last =
            tokens[close - 1]?.kind === "space" ? close - 2 : close - 1;
        this.#space(code, last, spacing);
        this.#space(code, open, spacing);
    }

    /** The `>` closing a type argument list opened at index, on one line. */
    #generic(code: Code, index: number): Token | undefined {
        const { tokens } = code;
        if (tokens[index]?.value !== "<" || tokens[index - 1]?.kind !== "word")
            return;

        let depth = 0;
        for (let next = index; next < tokens.length; next++) {
            const { kind, value } = tokens[next] as Token;

            if (kind === "newline" || [";", "{", "}"].includes(value)) return;
            if (kind !== "punct") continue;
            if (value === "<") depth++;
            if (value === ">" && --depth === 0) return tokens[next];
        }
    }

    #template(value: string): string {
        let result = value;

        for (const [start, end] of Lexer.interpolations(value).reverse()) {
            const inner = result.slice(start, end);
            if (/[\r\n]/.test(inner) || !inner.trim()) continue;

            const space = this.#delimiterSpacing ? " " : "";
            result =
                result.slice(0, start) +
                space +
                inner.trim() +
                space +
                result.slice(end);
        }

        return result;
    }

    #spacing(open: Token): boolean | undefined {
        if (open.kind !== "punct") return;
        if (open.value !== "{") return this.#delimiterSpacing;
        return ["enum", "object"].includes(open.bracket ?? "")
            ? this.#bracketSpacing
            : undefined;
    }

    /** Sets the gap after the token at index, unless it ends a line. */
    #space(code: Code, index: number, spacing: boolean): void {
        const gap = code.tokens[index + 1];
        const next = gap?.kind === "space" ? code.tokens[index + 2] : gap;

        if (
            code.tokens[index]?.kind === "newline" ||
            ["comment", "newline", undefined].includes(next?.kind)
        )
            return;

        if (gap?.kind === "space") {
            if (spacing) gap.value = " ";
            else code.remove(index + 1);
        } else if (spacing)
            code.tokens.splice(index + 1, 0, { kind: "space", value: " " });
    }
}
