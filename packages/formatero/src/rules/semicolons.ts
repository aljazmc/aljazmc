import type { Javascript, Rule } from "../rules.js";
import Code from "../tokens/code.js";
import type { Token } from "../tokens/token.js";

export default class Semicolons implements Rule {
    /** Words that cannot end a statement. */
    static readonly #open = new Set([
        "abstract",
        "as",
        "async",
        "await",
        "case",
        "class",
        "const",
        "declare",
        "default",
        "delete",
        "do",
        "else",
        "enum",
        "export",
        "extends",
        "finally",
        "function",
        "implements",
        "import",
        "in",
        "instanceof",
        "interface",
        "keyof",
        "let",
        "module",
        "namespace",
        "new",
        "of",
        "private",
        "protected",
        "public",
        "readonly",
        "satisfies",
        "static",
        "throw",
        "try",
        "typeof",
        "var",
    ]);

    /** Words that continue a statement from the previous line. */
    static readonly #continuing = new Set([
        "as",
        "catch",
        "extends",
        "finally",
        "implements",
        "in",
        "instanceof",
        "of",
        "satisfies",
    ]);

    /** Punctuators that start a new statement on the next line. */
    static readonly #starting = new Set(["!", "++", "--", "@", "}", "~"]);

    /** Tokens that would join the next line to the previous statement. */
    static readonly #hazards = new Set([
        "(",
        "*",
        "+",
        "-",
        ".",
        "/",
        "<",
        "?.",
        "[",
    ]);

    readonly #always: boolean;

    constructor({ semicolons }: Pick<Javascript, "semicolons">) {
        this.#always = semicolons === "always";
    }

    apply(code: Code): void {
        if (this.#always) this.#insert(code);
        else this.#remove(code);
    }

    static #statement(token: Token): boolean {
        return ["arrow", "block", "switch", undefined].includes(
            token.parent?.bracket,
        );
    }

    #insert(code: Code): void {
        const { tokens } = code;

        for (let index = tokens.length; index >= 0; index--) {
            if (index < tokens.length && tokens[index]?.kind !== "newline")
                continue;

            const last = code.seek(index, -1);
            const token = tokens[last];

            if (
                !token ||
                code.breaks(last, index) ||
                !Semicolons.#statement(token) ||
                !this.#ends(code, last) ||
                this.#continues(tokens[code.seek(index, 1)])
            )
                continue;

            code.insert(last + 1, ";", token.parent);
        }
    }

    #ends(code: Code, index: number): boolean {
        const token = code.tokens[index] as Token;
        const before = code.tokens[code.seek(index, -1)];

        switch (token.kind) {
            case "jsx":
                return token.value !== "<" && token.value !== ">";
            case "regex":
            case "string":
            case "template":
                return true;
            case "word":
                return (
                    !Semicolons.#open.has(token.value) && before?.value !== "@"
                );
            case "punct":
                break;
            default:
                return false;
        }

        switch (token.value) {
            case "++":
            case "--":
            case "]":
                return true;
            case "}":
                return ["arrow", "object"].includes(token.open?.bracket ?? "");
            case ")":
                return (
                    token.open?.bracket !== "header" &&
                    !this.#decorator(code, token.open)
                );
            case ">":
                return this.#generic(code, index);
            default:
                return false;
        }
    }

    #continues(next?: Token): boolean {
        if (!next) return false;
        if (next.kind === "template") return true;
        if (next.kind === "word") return Semicolons.#continuing.has(next.value);
        return next.kind === "punct" && !Semicolons.#starting.has(next.value);
    }

    #decorator(code: Code, open?: Token): boolean {
        const name = code.tokens.lastIndexOf(open?.before as Token);
        return name >= 0 && code.tokens[code.seek(name, -1)]?.value === "@";
    }

    /** Whether `>` closes a type argument list (`<` right after a word). */
    #generic(code: Code, index: number): boolean {
        let depth = 0;

        for (let current = index; current >= 0; current--) {
            const { kind, value } = code.tokens[current] as Token;

            if (kind !== "punct") continue;
            if ([";", "{", "}"].includes(value)) return false;
            if (value === ">") depth++;
            if (value === "<" && --depth === 0)
                return code.tokens[current - 1]?.kind === "word";
        }

        return false;
    }

    #remove(code: Code): void {
        const { tokens } = code;

        for (let index = tokens.length - 1; index >= 0; index--) {
            const token = tokens[index] as Token;
            if (token.kind !== "punct" || token.value !== ";") continue;

            const next = code.seek(index, 1);
            const after = tokens[next];
            const before = tokens[code.seek(index, -1)];

            if (
                Semicolons.#statement(token) &&
                (!after || after.value === "}" || code.breaks(index, next)) &&
                !(after?.kind === "template" || after?.kind === "regex") &&
                !Semicolons.#hazards.has(after?.value ?? "") &&
                before &&
                !this.#empty(before)
            )
                code.remove(index);
        }
    }

    /** Whether a semicolon after this token is an empty statement. */
    #empty(before: Token): boolean {
        return (
            [";", "{", "else", "do"].includes(before.value) ||
            (before.value === ")" && before.open?.bracket === "header") ||
            !Code.significant(before)
        );
    }
}
