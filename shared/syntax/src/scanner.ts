export type TokenType =
    | "eof"
    | "invalid"
    | "jsxText"
    | "name"
    | "number"
    | "private"
    | "punct"
    | "regex"
    | "string"
    | "template";

export interface Token {
    type: TokenType;
    value: string;
    start: number;
    end: number;
    /** Whether a line break precedes the token. */
    newline: boolean;
}

export interface Comment {
    type: "Block" | "Line";
    /** Raw text, delimiters included. */
    value: string;
    start: number;
    end: number;
}

export class ParseError extends SyntaxError {
    readonly position: number;

    constructor(message: string, position: number) {
        super(message);
        this.position = position;
    }
}

/**
 * Splits source into tokens on demand. The parser decides how ambiguous
 * characters are read: `/` as regex, `}` as template continuation, JSX text.
 */
export default class Scanner {
    static readonly #punctuators = [
        ">>>=",
        "...",
        "===",
        "!==",
        "**=",
        "&&=",
        "||=",
        "??=",
        "=>",
        "==",
        "!=",
        "<=",
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
    ];

    static readonly #greater = [">>>=", ">>>", ">>=", ">>", ">=", ">"];
    static readonly #less = ["<<=", "<<", "<=", "<"];

    readonly source: string;
    readonly comments: Comment[] = [];
    #position = 0;

    constructor(source: string) {
        this.source = source;
    }

    get position(): number {
        return this.#position;
    }

    /** Moves back (or forward) and forgets comments scanned beyond. */
    reset(position: number): void {
        this.#position = position;
        while ((this.comments.at(-1)?.start ?? -1) >= position)
            this.comments.pop();
    }

    next(): Token {
        const newline = this.#trivia();
        const start = this.#position;
        const char = this.source[start];

        if (char === undefined) return this.#token("eof", start, newline);
        if (Scanner.#identifierStart(char) || char === "\\")
            return this.#word("name", start, newline);
        if (char === "#") return this.#word("private", start, newline);
        if (
            /[0-9]/.test(char) ||
            (char === "." && /[0-9]/.test(this.source[start + 1] ?? ""))
        )
            return this.#number(start, newline);
        if (char === '"' || char === "'") return this.#string(start, newline);
        if (char === "`") return this.template(start, newline);

        const punctuator =
            Scanner.#punctuators.find(
                (value) =>
                    this.source.startsWith(value, start) &&
                    !(
                        value === "?." &&
                        /[0-9]/.test(this.source[start + 2] ?? "")
                    ),
            ) ?? char;

        this.#position = start + punctuator.length;
        return this.#token("punct", start, newline);
    }

    /** Rescans a `/` or `/=` token as a regular expression literal. */
    regex(token: Token): Token {
        let inClass = false;

        for (let index = token.start + 1; ; index++) {
            const char = this.source[index];

            if (char === undefined || char === "\n" || char === "\r")
                return this.#invalid(token.start, "Unterminated regex");
            if (char === "\\") index++;
            else if (char === "[") inClass = true;
            else if (char === "]") inClass = false;
            else if (char === "/" && !inClass) {
                this.#position = index + 1;
                while (
                    Scanner.#identifierPart(this.source[this.#position] ?? "")
                )
                    this.#position++;
                return this.#token("regex", token.start, token.newline);
            }
        }
    }

    /** Rescans `>` as the longest of `>>>=`, `>>>`, `>>=`, `>>`, `>=`. */
    greater(token: Token): Token {
        return this.#operator(token, Scanner.#greater);
    }

    /** Rescans `<` as the longest of `<<=`, `<<`, `<=`, since types nest `<<T>() => T>`. */
    less(token: Token): Token {
        return this.#operator(token, Scanner.#less);
    }

    #operator(token: Token, candidates: string[]): Token {
        const value =
            candidates.find((value) =>
                this.source.startsWith(value, token.start),
            ) ?? token.value;
        this.reset(token.start + value.length);
        return { ...token, value, end: token.start + value.length };
    }

    /** Scans a template part, from a backtick or a closing `}`, up to `${` or a backtick. */
    template(start: number, newline = false): Token {
        for (let index = start + 1; index < this.source.length; index++) {
            const char = this.source[index];

            if (char === "\\") index++;
            else if (
                char === "`" ||
                (char === "$" && this.source[index + 1] === "{")
            ) {
                this.#position = index + (char === "`" ? 1 : 2);
                return this.#token("template", start, newline);
            }
        }

        return this.#invalid(start, "Unterminated template");
    }

    /** Scans JSX text up to `{` or `<`. */
    jsxText(start: number): Token {
        let index = start;
        while (
            index < this.source.length &&
            !"{<".includes(this.source[index] ?? "")
        )
            index++;
        this.#position = index;
        return this.#token("jsxText", start, false);
    }

    /** Rescans a name token to include JSX's `-` characters. */
    jsxName(token: Token): Token {
        let index = token.end;
        while (/[-\p{ID_Continue}$]/u.test(this.source[index] ?? "")) index++;
        this.reset(index);
        return {
            ...token,
            value: this.source.slice(token.start, index),
            end: index,
        };
    }

    /** Rescans a quoted JSX attribute value, which has no escapes. */
    jsxString(token: Token): Token {
        const quote = this.source[token.start] ?? "";
        const end = this.source.indexOf(quote, token.start + 1);
        if (end < 0) return this.#invalid(token.start, "Unterminated string");
        this.reset(end + 1);
        return {
            ...token,
            type: "string",
            value: this.source.slice(token.start, end + 1),
            end: end + 1,
        };
    }

    #token(type: TokenType, start: number, newline: boolean): Token {
        return {
            type,
            value: this.source.slice(start, this.#position),
            start,
            end: this.#position,
            newline,
        };
    }

    #invalid(start: number, message: string): Token {
        this.#position = this.source.length;
        return {
            type: "invalid",
            value: message,
            start,
            end: start,
            newline: false,
        };
    }

    /** Skips whitespace and comments, returns whether a line break was crossed. */
    #trivia(): boolean {
        let newline = false;

        if (this.#position === 0 && this.source.startsWith("#!")) {
            const end = this.#lineEnd(0);
            this.comments.push({
                type: "Line",
                value: this.source.slice(0, end),
                start: 0,
                end,
            });
            this.#position = end;
        }

        while (this.#position < this.source.length) {
            const char = this.source[this.#position] ?? "";
            const next = this.source[this.#position + 1];

            if (
                char === "\n" ||
                char === "\r" ||
                char === "\u2028" ||
                char === "\u2029"
            ) {
                newline = true;
                this.#position++;
            } else if (/\s/.test(char)) this.#position++;
            else if (char === "/" && next === "/") {
                const end = this.#lineEnd(this.#position);
                this.#comment("Line", end);
            } else if (char === "/" && next === "*") {
                const close = this.source.indexOf("*/", this.#position + 2);
                const end = close < 0 ? this.source.length : close + 2;
                if (
                    /[\r\n\u2028\u2029]/.test(
                        this.source.slice(this.#position, end),
                    )
                )
                    newline = true;
                this.#comment("Block", end);
            } else break;
        }

        return newline;
    }

    #comment(type: Comment["type"], end: number): void {
        const start = this.#position;
        this.comments.push({
            type,
            value: this.source.slice(start, end),
            start,
            end,
        });
        this.#position = end;
    }

    #lineEnd(start: number): number {
        const match = /[\r\n\u2028\u2029]/.exec(this.source.slice(start));
        return match ? start + match.index : this.source.length;
    }

    #word(type: TokenType, start: number, newline: boolean): Token {
        let index = start + 1;
        while (index < this.source.length) {
            const char = this.source[index] ?? "";
            if (char === "\\")
                index += /^\\u\{/.test(this.source.slice(index, index + 3))
                    ? this.source.indexOf("}", index) - index + 1
                    : 6;
            else if (Scanner.#identifierPart(char)) index += char.length;
            else {
                const code = this.source.codePointAt(index) ?? 0;
                const symbol = String.fromCodePoint(code);
                if (code > 0xffff && Scanner.#identifierPart(symbol))
                    index += 2;
                else break;
            }
        }
        this.#position = index;
        return this.#token(type, start, newline);
    }

    #number(start: number, newline: boolean): Token {
        const pattern =
            /0[xX][\da-fA-F_]+n?|0[oO][0-7_]+n?|0[bB][01_]+n?|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?n?/y;
        pattern.lastIndex = start;
        pattern.exec(this.source);
        this.#position = pattern.lastIndex;
        return this.#token("number", start, newline);
    }

    #string(start: number, newline: boolean): Token {
        const quote = this.source[start];

        for (let index = start + 1; index < this.source.length; index++) {
            const char = this.source[index];

            if (char === "\\")
                index += this.source.startsWith("\r\n", index + 1) ? 2 : 1;
            else if (char === quote) {
                this.#position = index + 1;
                return this.#token("string", start, newline);
            } else if (char === "\n" || char === "\r") break;
        }

        return this.#invalid(start, "Unterminated string");
    }

    static #identifierStart(char: string): boolean {
        return /[\p{ID_Start}$_]/u.test(char) || /[\ud800-\udbff]/.test(char);
    }

    static #identifierPart(char: string): boolean {
        return /[\p{ID_Continue}$‌‍]/u.test(char);
    }
}
