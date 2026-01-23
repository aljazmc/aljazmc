import type { Javascript, Rule } from "../rules.js";
import type Code from "../tokens/code.js";
import type { Token } from "../tokens/token.js";

/** Trailing commas in multiline lists where the style allows them, none elsewhere. */
export default class TrailingCommas implements Rule {
    readonly #style: Javascript["trailingCommas"];

    constructor({ trailingCommas }: Pick<Javascript, "trailingCommas">) {
        this.#style = trailingCommas;
    }

    apply(code: Code): void {
        const { tokens } = code;

        for (let index = tokens.length - 1; index >= 0; index--) {
            const close = tokens[index];
            if (!close?.open || close.kind !== "punct") continue;

            const last = code.seek(index, -1);
            const previous = tokens[last];
            if (!previous || previous === close.open) continue;

            const wanted =
                this.#style !== "none" &&
                code.breaks(last, index) &&
                this.#accepts(code, close, index) &&
                !this.#rest(code, close.open, last);

            if (previous.value === ",") {
                const before = tokens[code.seek(last, -1)];
                if (!wanted && before !== close.open && before?.value !== ",")
                    code.remove(last);
            } else if (wanted && previous.value !== ";")
                code.insert(last + 1, ",", close.open);
        }
    }

    #accepts(code: Code, close: Token, index: number): boolean {
        switch (close.open?.bracket) {
            case "enum":
            case "list":
            case "object":
                return true;
            case "call":
                return (
                    this.#style === "all" &&
                    close.open.before?.value !== "import"
                );
            case "group":
                return (
                    this.#style === "all" &&
                    code.tokens[code.seek(index, 1)]?.value === "=>"
                );
            default:
                return false;
        }
    }

    /** Whether the last element is a rest element, which forbids a comma. */
    #rest(code: Code, open: Token, last: number): boolean {
        let index = last;

        while (
            index > 0 &&
            code.tokens[index] !== open &&
            !(
                code.tokens[index]?.parent === open &&
                code.tokens[index]?.value === ","
            )
        )
            index--;

        return code.tokens[code.seek(index, 1)]?.value === "...";
    }
}
