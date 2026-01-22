import type { Node, NodeOf, NodeType } from "../ast.js";
import Scanner, { ParseError, type Token } from "../scanner.js";

export interface Options {
    jsx: boolean;
    typescript: boolean;
}

interface Snapshot {
    position: number;
    token: Token;
    previous: number;
}

type Fields<T extends NodeType> = Omit<NodeOf<T>, "end" | "start" | "type">;

export default abstract class BaseParser {
    protected readonly source: string;
    protected readonly scanner: Scanner;
    protected readonly options: Options;
    protected token: Token;
    /** End of the last consumed token. */
    protected previous = 0;
    /** Whether `in` is a binary operator here (not in a for-in head). */
    protected allowIn = true;

    constructor(source: string, options: Options) {
        this.source = source;
        this.options = options;
        this.scanner = new Scanner(source);
        this.token = this.scanner.next();
    }

    abstract parseAssignment(): Node;

    get comments(): Scanner["comments"] {
        return this.scanner.comments;
    }

    protected next(): Token {
        const token = this.token;
        if (token.type === "invalid") this.raise(token.value, token.start);
        this.previous = token.end;
        this.token = this.scanner.next();
        return token;
    }

    /** Replaces the current token with a rescanned one. */
    protected replace(token: Token): void {
        this.token = token;
    }

    /** Continues scanning from a position, discarding the current token. */
    protected rescan(position: number): void {
        this.scanner.reset(position);
        this.token = this.scanner.next();
    }

    protected is(value: string, token = this.token): boolean {
        return (
            token.value === value &&
            (token.type === "punct" || token.type === "name")
        );
    }

    protected isName(token = this.token): boolean {
        return token.type === "name";
    }

    protected eat(value: string): boolean {
        if (!this.is(value)) return false;
        this.next();
        return true;
    }

    protected expect(value: string): Token {
        if (!this.is(value)) this.unexpected(`Expected "${value}"`);
        return this.next();
    }

    /** Peeks the token after the current one. */
    protected peek(): Token {
        const snapshot = this.snapshot();
        this.next();
        const token = this.token;
        this.restore(snapshot);
        return token;
    }

    protected snapshot(): Snapshot {
        return {
            position: this.scanner.position,
            token: this.token,
            previous: this.previous,
        };
    }

    protected restore({ position, token, previous }: Snapshot): void {
        this.scanner.reset(position);
        this.token = token;
        this.previous = previous;
    }

    /** Runs a speculative parse, undoing it when it fails. */
    protected attempt<T>(parse: () => T): T | undefined {
        const snapshot = this.snapshot();
        try {
            return parse();
        } catch (error) {
            if (!(error instanceof ParseError)) throw error;
            this.restore(snapshot);
            return undefined;
        }
    }

    protected finish<T extends NodeType>(
        type: T,
        start: number,
        fields: Fields<T>,
    ): NodeOf<T> {
        return { type, start, end: this.previous, ...fields } as NodeOf<T>;
    }

    /** Consumes a semicolon or accepts automatic semicolon insertion. */
    protected semicolon(): void {
        if (this.eat(";")) return;
        if (this.is("}") || this.token.type === "eof" || this.token.newline)
            return;
        this.unexpected('Expected ";"');
    }

    protected canInsertSemicolon(): boolean {
        return (
            this.is(";") ||
            this.is("}") ||
            this.token.type === "eof" ||
            this.token.newline
        );
    }

    protected unexpected(message = "Unexpected token"): never {
        const { type, value, start } = this.token;
        this.raise(
            `${message}, got ${type === "eof" ? "end of file" : `"${value}"`}`,
            start,
        );
    }

    protected raise(message: string, position: number): never {
        const before = this.source.slice(0, position);
        const line = before.split("\n").length;
        const column = position - before.lastIndexOf("\n");
        throw new ParseError(`${message} (${line}:${column})`, position);
    }
}
