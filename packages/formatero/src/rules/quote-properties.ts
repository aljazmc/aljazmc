import type { Javascript, Rule } from "../rules.js";
import type Code from "../tokens/code.js";

export default class QuoteProperties implements Rule {
    readonly #asNeeded: boolean;

    constructor({ quoteProperties }: Pick<Javascript, "quoteProperties">) {
        this.#asNeeded = quoteProperties === "asNeeded";
    }

    apply(code: Code): void {
        if (!this.#asNeeded) return;

        for (const [index, token] of code.tokens.entries()) {
            const body = token.value.slice(1, -1);

            if (
                token.kind === "string" &&
                ["block", "object"].includes(token.parent?.bracket ?? "") &&
                ["{", ",", ";"].includes(
                    code.tokens[code.seek(index, -1)]?.value ?? "",
                ) &&
                code.tokens[code.seek(index, 1)]?.value === ":" &&
                /^[\p{ID_Start}$_][\p{ID_Continue}$]*$/u.test(body)
            )
                token.value = body;
        }
    }
}
