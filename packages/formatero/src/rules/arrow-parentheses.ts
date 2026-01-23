import type { Javascript, Rule } from "../rules.js";
import type Code from "../tokens/code.js";

export default class ArrowParentheses implements Rule {
    readonly #always: boolean;

    constructor({ arrowParentheses }: Pick<Javascript, "arrowParentheses">) {
        this.#always = arrowParentheses === "always";
    }

    apply(code: Code): void {
        const { tokens } = code;

        for (let index = tokens.length - 1; index >= 0; index--) {
            if (tokens[index]?.value !== "=>") continue;

            const last = code.seek(index, -1);
            const param = tokens[last];

            if (this.#always && param?.kind === "word") {
                const before = tokens[code.seek(last, -1)]?.value ?? "";
                if ([":", ".", "?."].includes(before)) continue;

                const open = code.insert(last, "(", param.parent);
                open.bracket = "group";
                code.insert(last + 2, ")", param.parent).open = open;
            } else if (!this.#always && param?.value === ")" && param.open) {
                const open = tokens.lastIndexOf(param.open, last);

                if (
                    last - open === 2 &&
                    tokens[open + 1]?.kind === "word" &&
                    tokens[code.seek(open, -1)]?.value !== ">"
                ) {
                    code.remove(last);
                    code.remove(open);
                }
            }
        }
    }
}
