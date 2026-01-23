import type { Kind, Token } from "./token.js";

export default class Lexer {
    static readonly #patterns: Partial<Record<Kind, RegExp>> = {
        newline: /\r\n|\r|\n/y,
        space: /[^\S\r\n]+/y,
        comment: /\/\/[^\r\n]*|\/\*[\s\S]*?(?:\*\/|$)/y,
        string: /(["'])(?:\\[\s\S]|(?!\1)[^\\\r\n])*\1?/y,
        word: /[\p{ID_Continue}$#\\‌‍]+/uy,
    };

    static readonly #punctuators = [
        "...",
        "===",
        "!==",
        "**=",
        "<<=",
        "&&=",
        "||=",
        "??=",
        "=>",
        "==",
        "!=",
        "<=",
        ">=",
        "&&",
        "||",
        "??",
        "?.",
        "++",
        "--",
        "+=",
        "-=",
        "*=",
        "/=",
        "%=",
        "&=",
        "|=",
        "^=",
        "**",
        "<<",
    ];

    /** Words after which an expression (regex, JSX) may start. */
    static readonly #operators = new Set([
        "await",
        "case",
        "delete",
        "do",
        "else",
        "extends",
        "in",
        "instanceof",
        "new",
        "of",
        "return",
        "throw",
        "typeof",
        "void",
        "yield",
    ]);

    readonly #source: string;
    readonly #jsx: boolean;
    readonly #tokens: Token[] = [];
    #position: number;

    constructor(source: string, jsx = false, position = 0) {
        this.#source = source;
        this.#jsx = jsx;
        this.#position = position;
    }

    /** Start and end offsets of the expressions inside a template's `${}`. */
    static interpolations(template: string): [number, number][] {
        const ranges: [number, number][] = [];

        for (let index = 1; index < template.length - 1; index++) {
            if (template[index] === "\\") index++;
            else if (template.startsWith("${", index)) {
                const inner = new Lexer(template, false, index + 2);
                inner.#expression(true);
                ranges.push([index + 2, inner.#position - 1]);
                index = inner.#position - 1;
            }
        }

        return ranges;
    }

    tokens(): Token[] {
        this.#expression(false);
        return this.#tokens;
    }

    /** Lexes until the end, or until an unmatched `}` when nested. */
    #expression(nested: boolean): void {
        let depth = 0;

        while (this.#position < this.#source.length) {
            const char = this.#source[this.#position];

            if (char === "}" && nested && depth === 0) {
                this.#push("punct", "}");
                return;
            }

            if (char === "{") depth++;
            else if (char === "}") depth--;

            this.#next();
        }
    }

    #next(): void {
        const rest = this.#source.slice(this.#position, this.#position + 2);
        const expects = this.#expects();

        if (
            this.#match("newline") ||
            this.#match("space") ||
            this.#match("comment")
        )
            return;

        if (this.#position === 0 && this.#match("comment", /#![^\r\n]*/y))
            return;

        if (rest[0] === "`") {
            this.#push("template", this.#template());
            return;
        }

        if (rest[0] === "/" && expects) {
            const regex = this.#regex();
            if (regex) {
                this.#push("regex", regex);
                return;
            }
        }

        if (rest[0] === "<" && expects && this.#jsx && this.#element()) return;

        if (this.#match("string") || this.#match("word")) return;

        const punctuator =
            Lexer.#punctuators.find((value) =>
                this.#source.startsWith(value, this.#position),
            ) ?? rest[0];

        this.#push("punct", punctuator ?? "");
    }

    #push(kind: Kind, value: string): void {
        this.#tokens.push({ kind, value });
        this.#position += value.length;
    }

    #match(kind: Kind, pattern = Lexer.#patterns[kind]): boolean {
        if (!pattern) return false;

        pattern.lastIndex = this.#position;
        const [value] = pattern.exec(this.#source) ?? [""];

        if (value) this.#push(kind, value);
        return value !== "";
    }

    /** Whether an expression may start here, judged by the previous token. */
    #expects(): boolean {
        const previous = this.#tokens.findLast(
            ({ kind }) => !["comment", "newline", "space"].includes(kind),
        );

        if (!previous) return true;
        if (previous.kind === "word")
            return Lexer.#operators.has(previous.value);
        return previous.kind === "punct" && !")]}".includes(previous.value);
    }

    #template(): string {
        let index = this.#position + 1;

        while (index < this.#source.length && this.#source[index] !== "`") {
            if (this.#source[index] === "\\") index += 2;
            else if (this.#source.startsWith("${", index)) {
                const inner = new Lexer(this.#source, this.#jsx, index + 2);
                inner.#expression(true);
                index = inner.#position;
            } else index++;
        }

        return this.#source.slice(this.#position, index + 1);
    }

    #regex(): string | undefined {
        let inClass = false;

        for (let index = this.#position + 1; ; index++) {
            const char = this.#source[index];

            if (char === undefined || char === "\n" || char === "\r") return;
            if (char === "\\") index++;
            else if (char === "[") inClass = true;
            else if (char === "]") inClass = false;
            else if (char === "/" && !inClass) {
                const flags = /[a-z]*/y;
                flags.lastIndex = index + 1;
                flags.exec(this.#source);
                return this.#source.slice(this.#position, flags.lastIndex);
            }
        }
    }

    /** Lexes a JSX element, returns false for TSX generics like `<T,>`. */
    #element(): boolean {
        const head = this.#source.slice(this.#position, this.#position + 64);

        if (!/^<[\p{L}_$>]/u.test(head)) return false;
        if (/^<[\p{L}_$][\p{ID_Continue}$]*\s*(?:,|extends\b)/u.test(head))
            return false;

        this.#push("jsx", "<");
        this.#match("word", /[\p{ID_Continue}$.:-]+/uy);

        while (this.#position < this.#source.length) {
            const char = this.#source[this.#position];

            if (this.#match("newline") || this.#match("space")) continue;
            if (this.#source.startsWith("/>", this.#position)) {
                this.#push("jsx", "/>");
                return true;
            }
            if (char === ">") {
                this.#push("jsx", ">");
                break;
            }
            if (char === "{") {
                this.#push("punct", "{");
                this.#expression(true);
                continue;
            }
            if (
                this.#match("jsxString", /"[^"]*"?|'[^']*'?/y) ||
                this.#match("word", /[\p{ID_Continue}$.:-]+/uy)
            )
                continue;
            this.#push("punct", char ?? "");
        }

        while (this.#position < this.#source.length) {
            const char = this.#source[this.#position];

            if (this.#source.startsWith("</", this.#position)) {
                this.#match("jsx", /<\/[^>]*>?/y);
                return true;
            }
            if (char === "<") this.#element() || this.#push("jsxText", "<");
            else if (char === "{") {
                this.#push("punct", "{");
                this.#expression(true);
            } else
                this.#match("newline") ||
                    this.#match("space") ||
                    this.#match("jsxText", /[^<{\r\n]+/y);
        }

        return true;
    }
}
