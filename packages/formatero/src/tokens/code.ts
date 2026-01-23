import Lexer from "./lexer.js";
import type { Bracket, Token } from "./token.js";

export default class Code {
    static readonly headers = new Set([
        "catch",
        "for",
        "if",
        "switch",
        "while",
        "with",
    ]);

    /** Words after which `(` groups an expression instead of calling. */
    static readonly #operators = new Set([
        "as",
        "await",
        "case",
        "delete",
        "do",
        "else",
        "extends",
        "in",
        "instanceof",
        "keyof",
        "new",
        "of",
        "return",
        "satisfies",
        "throw",
        "typeof",
        "void",
        "yield",
    ]);

    /** Tokens after which `{` starts an object literal or a type literal. */
    static readonly #objects = new Set([
        "!",
        "&",
        "&&",
        "(",
        ",",
        "...",
        ":",
        "<",
        "=",
        "?",
        "??",
        "[",
        "|",
        "||",
        "as",
        "assert",
        "await",
        "case",
        "const",
        "default",
        "export",
        "extends",
        "import",
        "in",
        "keyof",
        "let",
        "of",
        "return",
        "satisfies",
        "throw",
        "type",
        "typeof",
        "using",
        "var",
        "with",
        "yield",
    ]);

    readonly tokens: Token[];
    readonly #json: boolean;

    constructor(source: string, { jsx = false, json = false } = {}) {
        this.tokens = new Lexer(source, jsx).tokens();
        this.#json = json;
        this.#annotate();
    }

    static significant(token?: Token): token is Token {
        return (
            token !== undefined &&
            !["comment", "newline", "space"].includes(token.kind)
        );
    }

    static opens(token: Token): boolean {
        return token.kind === "jsx"
            ? token.value === "<" || token.value === ">"
            : token.kind === "punct" && "([{".includes(token.value);
    }

    static closes(token: Token): boolean {
        return token.kind === "jsx"
            ? token.value !== "<"
            : token.kind === "punct" && ")]}".includes(token.value);
    }

    /** Index of the nearest significant token in the direction of step. */
    seek(index: number, step: 1 | -1): number {
        let next = index + step;

        while (
            next >= 0 &&
            next < this.tokens.length &&
            !Code.significant(this.tokens[next])
        )
            next += step;

        return next;
    }

    /** Whether a line break lies between the tokens at from and to. */
    breaks(from: number, to: number): boolean {
        return this.tokens
            .slice(from + 1, to)
            .some((token) => token.kind === "newline");
    }

    insert(index: number, value: string, parent?: Token): Token {
        const token: Token = { kind: "punct", value };
        if (parent) token.parent = parent;
        this.tokens.splice(index, 0, token);
        return token;
    }

    remove(index: number): void {
        this.tokens.splice(index, 1);
    }

    toString(): string {
        return this.tokens.map(({ value }) => value).join("");
    }

    #annotate(): void {
        const stack: Token[] = [];

        for (const [index, token] of this.tokens.entries()) {
            if (Code.closes(token)) {
                const open = stack.pop();
                if (open) token.open = open;
            }

            const parent = stack.at(-1);
            if (parent) token.parent = parent;

            if (Code.opens(token)) {
                const before = this.tokens[this.seek(index, -1)];
                if (before) token.before = before;
                token.bracket = this.#classify(token, index);
                stack.push(token);
            }
        }
    }

    #classify(token: Token, index: number): Bracket {
        const before = token.before;

        if (token.kind === "jsx")
            return token.value === "<" ? "tag" : "children";
        if (token.value === "[") return "list";

        if (token.value === "(") {
            if (before?.kind === "word") {
                if (Code.headers.has(before.value)) return "header";
                return Code.#operators.has(before.value) ? "group" : "call";
            }
            return before?.kind === "template" ||
                [")", "]", "?.", ">"].includes(before?.value ?? "")
                ? "call"
                : "group";
        }

        if (this.#json) return "object";
        if (["tag", "children"].includes(token.parent?.bracket ?? ""))
            return "expression";
        if (!before) return "block";
        if (before.value === "=>") return "arrow";
        if (before.value === ")" && before.open?.before?.value === "switch")
            return "switch";
        if (before.value === ":" && before.parent?.bracket === "switch")
            return "block";
        if (Code.#objects.has(before.value)) return "object";

        const keyword = this.tokens[this.seek(this.seek(index, -1), -1)];
        return keyword?.value === "enum" ? "enum" : "block";
    }
}
