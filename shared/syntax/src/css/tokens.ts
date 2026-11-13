import { ParseError } from "../scanner.js";
import type { Comment } from "./ast.js";

export type TokenType =
    | "ident"
    | "function"
    | "at"
    | "hash"
    | "string"
    | "url"
    | "number"
    | "percentage"
    | "dimension"
    | "unicode-range"
    | "whitespace"
    | "delim"
    | "colon"
    | "semicolon"
    | "comma"
    | "("
    | ")"
    | "["
    | "]"
    | "{"
    | "}"
    | "cdo"
    | "cdc"
    | "eof";

export interface Token {
    type: TokenType;
    start: number;
    end: number;
    /** The name of idents, functions, at-keywords and hashes, the number of numeric tokens, the character of delimiters. */
    value: string;
    /** The unit of dimensions, the name of urls. */
    unit?: string;
    /** Whether a string ends with its quote. */
    closed?: boolean;
}

const isDigit = (char: string | undefined) =>
    char !== undefined && char >= "0" && char <= "9";
const isHex = (char: string | undefined) =>
    char !== undefined && /^[0-9a-fA-F]$/.test(char);
const isNameStart = (char: string | undefined) =>
    char !== undefined &&
    (/^[A-Za-z_]$/.test(char) || char.charCodeAt(0) >= 0x80);
const isName = (char: string | undefined) =>
    char !== undefined && (isNameStart(char) || isDigit(char) || char === "-");
export const isWhitespace = (char: string | undefined) =>
    char === " " ||
    char === "\t" ||
    char === "\n" ||
    char === "\r" ||
    char === "\f";

/** Splits CSS into tokens like CSS Syntax Level 3, collecting comments. */
export default class Tokenizer {
    readonly source: string;
    readonly comments: Comment[] = [];
    /** Errors of a tokenizer that recovers from them, others throw them. */
    readonly errors: ParseError[] | null;
    #position: number;

    constructor(source: string, start = 0, recover = false) {
        this.source = source;
        this.#position = start;
        this.errors = recover ? [] : null;
    }

    #fail(message: string, position: number): void {
        const error = new ParseError(message, position);
        if (!this.errors) throw error;
        this.errors.push(error);
    }

    /** Every token to the end, the last one is `eof`. */
    tokenize(): Token[] {
        const tokens: Token[] = [];
        for (;;) {
            const token = this.next();
            tokens.push(token);
            if (token.type === "eof") return tokens;
        }
    }

    #validEscape(at: number): boolean {
        return this.source[at] === "\\" && this.source[at + 1] !== "\n";
    }

    #identStart(at: number): boolean {
        const source = this.source;
        const char = source[at];
        if (char === "-")
            return (
                isNameStart(source[at + 1]) ||
                source[at + 1] === "-" ||
                this.#validEscape(at + 1)
            );
        if (isNameStart(char)) return true;
        return this.#validEscape(at);
    }

    #numberStart(at: number): boolean {
        const source = this.source;
        const char = source[at];
        if (char === "+" || char === "-")
            return (
                isDigit(source[at + 1]) ||
                (source[at + 1] === "." && isDigit(source[at + 2]))
            );
        if (char === ".") return isDigit(source[at + 1]);
        return isDigit(char);
    }

    #escape(): void {
        // at the character after the backslash
        const source = this.source;
        if (isHex(source[this.#position])) {
            let count = 0;
            while (count < 6 && isHex(source[this.#position])) {
                this.#position++;
                count++;
            }
            if (isWhitespace(source[this.#position])) this.#position++;
        } else if (this.#position < source.length) this.#position++;
    }

    #name(): string {
        const source = this.source;
        const start = this.#position;
        for (;;) {
            const char = source[this.#position];
            if (isName(char)) this.#position++;
            else if (this.#validEscape(this.#position)) {
                this.#position++;
                this.#escape();
            } else break;
        }
        return source.slice(start, this.#position);
    }

    #number(): string {
        const source = this.source;
        const start = this.#position;
        if (source[this.#position] === "+" || source[this.#position] === "-")
            this.#position++;
        while (isDigit(source[this.#position])) this.#position++;
        if (
            source[this.#position] === "." &&
            isDigit(source[this.#position + 1])
        ) {
            this.#position++;
            while (isDigit(source[this.#position])) this.#position++;
        }
        const e = source[this.#position];
        if (
            (e === "e" || e === "E") &&
            (isDigit(source[this.#position + 1]) ||
                ((source[this.#position + 1] === "+" ||
                    source[this.#position + 1] === "-") &&
                    isDigit(source[this.#position + 2])))
        ) {
            this.#position += 2;
            while (isDigit(source[this.#position])) this.#position++;
        }
        return source.slice(start, this.#position);
    }

    #comment(): void {
        const source = this.source;
        const start = this.#position;
        const close = source.indexOf("*/", start + 2);
        if (close < 0) this.#fail("Unterminated block comment", start);
        this.#position = close < 0 ? source.length : close + 2;
        this.comments.push({
            type: "Comment",
            start,
            end: this.#position,
            value: source.slice(start, this.#position),
        });
    }

    next(): Token {
        const source = this.source;
        // comments are trivia
        while (source.startsWith("/*", this.#position)) this.#comment();
        const start = this.#position;
        const char = source[start];
        const token = (type: TokenType, value = ""): Token => ({
            type,
            start,
            end: this.#position,
            value,
        });

        if (char === undefined) return token("eof");

        if (isWhitespace(char)) {
            while (isWhitespace(source[this.#position])) this.#position++;
            return token("whitespace");
        }

        if (char === '"' || char === "'") return this.#string(char);

        if (char === "#") {
            this.#position++;
            if (
                isName(source[this.#position]) ||
                this.#validEscape(this.#position)
            )
                return token("hash", this.#name());
            return token("delim", "#");
        }

        if (this.#numberStart(start)) {
            const value = this.#number();
            if (this.#identStart(this.#position)) {
                const unit = this.#name();
                return { ...token("dimension", value), unit };
            }
            if (source[this.#position] === "%") {
                this.#position++;
                return token("percentage", value);
            }
            return token("number", value);
        }

        if (
            (char === "u" || char === "U") &&
            source[start + 1] === "+" &&
            (isHex(source[start + 2]) || source[start + 2] === "?")
        ) {
            this.#position += 2;
            let count = 0;
            while (count < 6 && isHex(source[this.#position])) {
                this.#position++;
                count++;
            }
            while (count < 6 && source[this.#position] === "?") {
                this.#position++;
                count++;
            }
            if (
                source[this.#position] === "-" &&
                isHex(source[this.#position + 1])
            ) {
                this.#position++;
                count = 0;
                while (count < 6 && isHex(source[this.#position])) {
                    this.#position++;
                    count++;
                }
            }
            return token("unicode-range", source.slice(start, this.#position));
        }

        if (this.#identStart(start)) {
            const name = this.#name();
            if (source[this.#position] === "(") {
                this.#position++;
                if (/^url$/i.test(name)) {
                    // an unquoted address is a url token, a quoted one a function
                    let at = this.#position;
                    while (isWhitespace(source[at])) at++;
                    if (source[at] !== '"' && source[at] !== "'")
                        return this.#url(start, name);
                }
                return token("function", name);
            }
            return token("ident", name);
        }

        if (char === "@") {
            this.#position++;
            if (this.#identStart(this.#position))
                return token("at", this.#name());
            return token("delim", "@");
        }

        if (source.startsWith("<!--", start)) {
            this.#position += 4;
            return token("cdo");
        }
        if (source.startsWith("-->", start)) {
            this.#position += 3;
            return token("cdc");
        }

        this.#position++;
        switch (char) {
            case ":":
                return token("colon");
            case ";":
                return token("semicolon");
            case ",":
                return token("comma");
            case "(":
            case ")":
            case "[":
            case "]":
            case "{":
            case "}":
                return token(char);
            case "\\":
                this.#fail("Invalid escape sequence", start);
                break;
        }
        return token("delim", char);
    }

    #string(quote: string): Token {
        const source = this.source;
        const start = this.#position;
        this.#position++;
        let closed = false;
        for (;;) {
            const char = source[this.#position];
            if (char === undefined) break;
            if (char === quote) {
                this.#position++;
                closed = true;
                break;
            }
            if (char === "\n" || char === "\r" || char === "\f") break;
            if (char === "\\") {
                this.#position++;
                if (source[this.#position] === "\r") this.#position++;
                if (source[this.#position] !== undefined) this.#position++;
                continue;
            }
            this.#position++;
        }
        if (!closed) this.#fail("Missing closing quote", start);
        return {
            type: "string",
            start,
            end: this.#position,
            value: source.slice(start, this.#position),
            closed,
        };
    }

    /** An unquoted url, after its `(`. */
    #url(start: number, name: string): Token {
        const source = this.source;
        while (isWhitespace(source[this.#position])) this.#position++;
        const valueStart = this.#position;
        let valueEnd = valueStart;
        for (;;) {
            const char = source[this.#position];
            if (char === undefined) {
                this.#fail("Unterminated url", start);
                break;
            }
            if (char === ")") {
                this.#position++;
                break;
            }
            if (isWhitespace(char)) {
                this.#position++;
                continue;
            }
            if (char === "\\" && this.#validEscape(this.#position)) {
                this.#position++;
                this.#escape();
                valueEnd = this.#position;
                continue;
            }
            if (char === "(") {
                // `url(var(--a))` is a function with a function in it
                this.#position = start + name.length + 1;
                return {
                    type: "function",
                    start,
                    end: this.#position,
                    value: name,
                };
            }
            if (char === '"' || char === "'")
                this.#fail("Unexpected character in url", this.#position);
            this.#position++;
            valueEnd = this.#position;
        }
        return {
            type: "url",
            start,
            end: this.#position,
            value: source.slice(valueStart, valueEnd),
            unit: name,
        };
    }
}
