import { ParseError } from "../scanner.js";
import type {
    AtRule,
    AttributeSelector,
    Block,
    Combinator,
    CompoundSelector,
    Declaration,
    Identifier,
    Important,
    Item,
    Nth,
    PseudoArgument,
    Rule,
    Selector,
    SelectorList,
    SimpleBlock,
    Statement,
    StringValue,
    Stylesheet,
    SubSelector,
    Value,
} from "./ast.js";
import Tokenizer, { isWhitespace, type Token } from "./tokens.js";

/** Pseudo classes and elements whose argument is a list of selectors. */
const SELECTOR_PSEUDOS = new Set([
    "is",
    "where",
    "not",
    "matches",
    "any",
    "-webkit-any",
    "-moz-any",
    "has",
    "host",
    "host-context",
    "slotted",
    "current",
    "past",
    "future",
    "cue",
    "cue-region",
    "global",
    "local",
    "deep",
]);

/** Pseudo classes whose argument is An+B, maybe with `of` selectors. */
const NTH_PSEUDOS = new Set([
    "nth-child",
    "nth-last-child",
    "nth-of-type",
    "nth-last-of-type",
    "nth-col",
    "nth-last-col",
]);

/** At-rules whose blocks hold keyframes. */
const KEYFRAMES = /^(?:-[a-z]+-)?keyframes$/;

/** Parses CSS into rules, at-rules, declarations and component values. */
export default class Parser {
    readonly #source: string;
    readonly #tokenizer: Tokenizer;
    readonly #tokens: Token[];
    #index = 0;
    /** In a declaration value, where `name (` is a function like `name(`. */
    #declarationValue = false;

    /** Errors skipped while recovering, null when errors throw. */
    readonly #errors: ParseError[] | null;

    /** Parses a stylesheet, or only values from `start` to `end`, recovering from errors when asked. */
    constructor(source: string, start?: number, end?: number, recover = false) {
        this.#source = source;
        const bom = source.startsWith("\uFEFF");
        this.#tokenizer = new Tokenizer(
            end === undefined ? source : source.slice(0, end),
            start ?? (bom ? 1 : 0),
            recover,
        );
        this.#tokens = this.#tokenizer.tokenize();
        this.#errors = this.#tokenizer.errors;
    }

    /** An item, or when recovering from an error in it, null after skipping it. */
    #recovering(top: boolean, keyframes: boolean): Item | null {
        if (!this.#errors) return this.#item(top, keyframes);
        const start = this.#index;
        try {
            return this.#item(top, keyframes);
        } catch (error) {
            if (!(error instanceof ParseError)) throw error;
            this.#errors.push(error);
            this.#index = start;
            const from = this.#peek().start;
            this.#skipItem();
            // what was skipped is still an item, a block with it is not empty
            return {
                type: "Empty",
                start: from,
                end: Math.max(from, this.#peek(-1).end),
            };
        }
    }

    /** Skips to the end of an item: after its `;` or block, or before the `}` of its block. */
    #skipItem(): void {
        let depth = 0;
        for (;;) {
            const { type } = this.#peek();
            if (type === "eof" || (depth === 0 && type === "}")) return;
            this.#index++;
            if (
                type === "(" ||
                type === "[" ||
                type === "{" ||
                type === "function"
            )
                depth++;
            else if (type === ")" || type === "]" || type === "}") {
                depth = Math.max(0, depth - 1);
                if (depth === 0 && type === "}") return;
            } else if (depth === 0 && type === "semicolon") return;
        }
    }

    parse(): Stylesheet {
        const children: Statement[] = [];
        for (;;) {
            this.#skip(true);
            const token = this.#peek();
            if (token.type === "eof") break;
            if (token.type === "}") {
                if (!this.#errors) this.#error("Unexpected `}`", token.start);
                this.#errors.push(
                    new ParseError("Unexpected `}`", token.start),
                );
                this.#index++;
                continue;
            }
            const item = this.#recovering(true, false);
            if (item) children.push(item as Statement);
        }
        return {
            type: "Stylesheet",
            start: 0,
            end: this.#source.length,
            bom: this.#source.startsWith("\uFEFF"),
            children,
            comments: this.#tokenizer.comments,
            errors: (this.#errors ?? []).map(({ message, position }) => ({
                message,
                position,
            })),
        };
    }

    #error(message: string, position: number): never {
        throw new ParseError(message, position);
    }

    #peek(offset = 0): Token {
        return (
            this.#tokens[this.#index + offset] ?? (this.#tokens.at(-1) as Token)
        );
    }

    #next(): Token {
        const token = this.#peek();
        if (token.type !== "eof") this.#index++;
        return token;
    }

    /** Skips whitespace, and at the top level `<!--` and `-->`. */
    #skip(top = false): void {
        for (;;) {
            const { type } = this.#peek();
            if (
                type === "whitespace" ||
                (top && (type === "cdo" || type === "cdc"))
            )
                this.#index++;
            else return;
        }
    }

    /** The next token that is not whitespace, from an index. */
    #ahead(index: number): Token {
        let at = index;
        while (this.#tokens[at]?.type === "whitespace") at++;
        return this.#tokens[at] ?? (this.#tokens.at(-1) as Token);
    }

    /** A statement of a stylesheet or an item of a block. */
    #item(top: boolean, keyframes: boolean): Item {
        const token = this.#peek();
        if (token.type === "semicolon") {
            this.#next();
            return { type: "Empty", start: token.start, end: token.end };
        }
        if (token.type === "at") return this.#atRule();
        if (!top && !keyframes && this.#isDeclaration())
            return this.#declaration();
        return this.#rule(top, keyframes);
    }

    /**
     * Whether the item starting here is a declaration: a name and a colon,
     * not followed by a block before the end of the declaration, like
     * `a:hover { }` is a rule.
     */
    #isDeclaration(): boolean {
        const token = this.#peek();
        if (token.type !== "ident") {
            // IE hacks like `*zoom` are declarations
            if (
                token.type === "delim" &&
                /^[*_]$/.test(token.value) &&
                this.#peek(1).type === "ident" &&
                this.#ahead(this.#index + 2).type === "colon"
            )
                return !this.#blockAhead(this.#index + 2);
            return false;
        }
        if (this.#ahead(this.#index + 1).type !== "colon") return false;
        if (token.value.startsWith("--")) return true;
        return !this.#blockAhead(this.#index + 1);
    }

    /** Whether a `{` comes at depth 0 before the next `;` or `}`. */
    #blockAhead(from: number): boolean {
        let depth = 0;
        for (let at = from; at < this.#tokens.length; at++) {
            const { type } = this.#tokens[at] as Token;
            if (type === "(" || type === "[" || type === "function") depth++;
            else if (type === ")" || type === "]") depth--;
            else if (depth <= 0) {
                if (type === "{") return true;
                if (type === "semicolon" || type === "}") return false;
            }
            if (type === "eof") return false;
        }
        return false;
    }

    #rule(top: boolean, keyframes: boolean): Rule {
        const start = this.#peek().start;
        const prelude: Value[] = [];
        for (;;) {
            const token = this.#peek();
            if (token.type === "{") break;
            if (
                token.type === "eof" ||
                token.type === "}" ||
                token.type === "semicolon"
            )
                this.#error("expected a block", token.start);
            if (token.type === "whitespace") {
                this.#next();
                continue;
            }
            prelude.push(this.#value());
        }
        const end = prelude.at(-1)?.end ?? start;
        const selectors = keyframes
            ? null
            : new SelectorParser(this.#source, start, end, !top).list(!top);
        const block = this.#block(false);
        return {
            type: "Rule",
            start,
            end: block.end,
            selectors,
            prelude,
            block,
        };
    }

    #block(keyframes: boolean): Block {
        const open = this.#next();
        const children: Item[] = [];
        for (;;) {
            this.#skip();
            const token = this.#peek();
            if (token.type === "}") break;
            if (token.type === "eof") this.#error("expected `}`", token.start);
            const item = this.#recovering(false, keyframes);
            if (item) children.push(item);
        }
        const close = this.#next();
        return {
            type: "Block",
            start: open.start,
            end: close.end,
            children,
        };
    }

    #declaration(): Declaration {
        const first = this.#next();
        let property = first.value;
        let propertyEnd = first.end;
        if (first.type === "delim") {
            const name = this.#next();
            property = first.value + name.value;
            propertyEnd = name.end;
        }
        this.#skip();
        const colon = this.#next();
        const value: Value[] = [];
        for (;;) {
            const token = this.#peek();
            if (
                token.type === "semicolon" ||
                token.type === "}" ||
                token.type === "eof"
            )
                break;
            if (token.type === "whitespace") {
                this.#next();
                continue;
            }
            if (token.type === ")" || token.type === "]")
                this.#error(`Unexpected \`${token.type}\``, token.start);
            if (token.type === "{" && !property.startsWith("--"))
                this.#error("Unexpected `{`", token.start);
            this.#declarationValue = true;
            try {
                value.push(this.#value());
            } finally {
                this.#declarationValue = false;
            }
        }
        const important = Parser.#important(value);
        let end = important?.end ?? value.at(-1)?.end ?? colon.end;
        let semicolon = false;
        if (this.#peek().type === "semicolon") {
            end = this.#next().end;
            semicolon = true;
        }
        if (!property.startsWith("--") && value.length === 0 && !important)
            this.#error("Expected a value", colon.end);
        return {
            type: "Declaration",
            start: first.start,
            end,
            property,
            propertyEnd,
            colon: colon.start,
            value,
            important,
            semicolon,
        };
    }

    /** Takes a trailing `!important` off values. */
    static #important(value: Value[]): Important | null {
        const keyword = value.at(-1);
        const bang = value.at(-2);
        if (
            keyword?.type !== "Identifier" ||
            bang?.type !== "Delimiter" ||
            bang.value !== "!" ||
            keyword.value.toLowerCase() !== "important"
        )
            return null;
        value.splice(-2);
        return {
            type: "Important",
            start: bang.start,
            end: keyword.end,
            keyword: keyword.value,
        };
    }

    #atRule(): AtRule {
        const at = this.#next();
        const name = at.value;
        const keyword = name.toLowerCase();
        this.#skip();
        const prelude: Value[] = [];
        for (;;) {
            const token = this.#peek();
            if (
                token.type === "{" ||
                token.type === "semicolon" ||
                token.type === "}" ||
                token.type === "eof"
            )
                break;
            if (token.type === "whitespace") {
                this.#next();
                continue;
            }
            if (token.type === ")" || token.type === "]")
                this.#error(`Unexpected \`${token.type}\``, token.start);
            prelude.push(this.#value());
        }
        const preludeStart = prelude[0]?.start ?? at.end;
        const preludeEnd = prelude.at(-1)?.end ?? at.end;
        let block: Block | null = null;
        let semicolon = false;
        let end = preludeEnd;
        const token = this.#peek();
        if (token.type === "{") {
            block = this.#block(KEYFRAMES.test(keyword));
            end = block.end;
        } else if (token.type === "semicolon") {
            end = this.#next().end;
            semicolon = true;
        }
        return {
            type: "AtRule",
            start: at.start,
            end,
            name,
            keyword,
            prelude,
            preludeStart,
            preludeEnd,
            block,
            semicolon,
        };
    }

    /** A component value, with nested values of functions and blocks. */
    #value(): Value {
        const token = this.#next();
        const { start, end, value } = token;
        switch (token.type) {
            case "ident":
                // whitespace may come between the name of a function and its parenthesis
                if (
                    this.#declarationValue &&
                    !/^(?:and|or|not)$/i.test(value) &&
                    this.#ahead(this.#index).type === "("
                ) {
                    this.#skip();
                    const block = this.#value() as SimpleBlock;
                    return {
                        type: "Function",
                        start,
                        end: block.end,
                        name: value,
                        open: block.start,
                        children: block.children,
                        closed: block.closed,
                    };
                }
                return { type: "Identifier", start, end, value };
            case "number":
                return { type: "Number", start, end, value };
            case "percentage":
                return { type: "Percentage", start, end, value };
            case "dimension":
                return {
                    type: "Dimension",
                    start,
                    end,
                    value,
                    unit: token.unit ?? "",
                };
            case "string":
                return {
                    type: "String",
                    start,
                    end,
                    raw: value,
                    closed: token.closed ?? true,
                };
            case "hash":
                return { type: "Hash", start, end, value };
            case "unicode-range":
                return { type: "UnicodeRange", start, end, value };
            case "at":
                return { type: "AtKeyword", start, end, value };
            case "comma":
                return { type: "Comma", start, end };
            case "colon":
                return { type: "Colon", start, end };
            case "semicolon":
                return { type: "Semicolon", start, end };
            case "url": {
                const inner = this.#source.indexOf(
                    value,
                    start + (token.unit?.length ?? 3) + 1,
                );
                return {
                    type: "Url",
                    start,
                    end,
                    name: token.unit ?? "url",
                    value: value
                        ? {
                              type: "UrlRaw",
                              start: inner,
                              end: inner + value.length,
                              value,
                          }
                        : null,
                    modifiers: [],
                };
            }
            case "function": {
                const children = this.#values(")");
                const close = this.#peek();
                const closed = close.type === ")";
                if (!closed) this.#error("expected `)`", close.start);
                this.#next();
                if (
                    /^url$/i.test(value) &&
                    (children.length === 0 || children[0]?.type === "String")
                ) {
                    const [address, ...modifiers] = children;
                    return {
                        type: "Url",
                        start,
                        end: close.end,
                        name: value,
                        value: address?.type === "String" ? address : null,
                        modifiers,
                    };
                }
                return {
                    type: "Function",
                    start,
                    end: close.end,
                    name: value,
                    open: end - 1,
                    children,
                    closed,
                };
            }
            case "(":
            case "[":
            case "{": {
                const closing =
                    token.type === "(" ? ")" : token.type === "[" ? "]" : "}";
                const children = this.#values(closing);
                const close = this.#peek();
                const closed = close.type === closing;
                if (!closed)
                    this.#error(`expected \`${closing}\``, close.start);
                this.#next();
                return {
                    type: "SimpleBlock",
                    start,
                    end: close.end,
                    open: token.type,
                    children,
                    closed,
                };
            }
            case "cdo":
                return { type: "Delimiter", start, end, value: "<!--" };
            case "cdc":
                return { type: "Delimiter", start, end, value: "-->" };
            default:
                if (token.type === "eof")
                    this.#error("Unexpected end of file", start);
                if (
                    token.type === ")" ||
                    token.type === "]" ||
                    token.type === "}"
                )
                    this.#error(`Unexpected \`${token.type}\``, start);
                return { type: "Delimiter", start, end, value };
        }
    }

    /** Values up to a closing bracket, which stays next. */
    #values(closing: string): Value[] {
        const values: Value[] = [];
        for (;;) {
            const token = this.#peek();
            if (token.type === closing || token.type === "eof") return values;
            if (token.type === "whitespace") {
                this.#next();
                continue;
            }
            values.push(this.#value());
        }
    }

    /** Values of a range of the source, like the argument of a pseudo class. */
    static values(source: string, start: number, end: number): Value[] {
        const parser = new Parser(source, start, end);
        const values: Value[] = [];
        for (;;) {
            const token = parser.#peek();
            if (token.type === "eof") return values;
            if (token.type === "whitespace") {
                parser.#next();
                continue;
            }
            values.push(parser.#value());
        }
    }
}

const isNameStart = (char: string | undefined) =>
    char !== undefined &&
    (/^[A-Za-z_]$/.test(char) || char.charCodeAt(0) >= 0x80);
const isName = (char: string | undefined) =>
    char !== undefined && (isNameStart(char) || /^[0-9-]$/.test(char));

/** Parses selectors from a range of the source. */
class SelectorParser {
    readonly #source: string;
    readonly #end: number;
    readonly #nested: boolean;
    #position: number;

    constructor(source: string, start: number, end: number, nested: boolean) {
        this.#source = source;
        this.#position = start;
        this.#end = end;
        this.#nested = nested;
    }

    #error(message: string, position = this.#position): never {
        throw new ParseError(message, position);
    }

    #char(offset = 0): string | undefined {
        const at = this.#position + offset;
        return at < this.#end ? this.#source[at] : undefined;
    }

    /** Skips whitespace and comments, whether there were any. */
    #trivia(): boolean {
        const start = this.#position;
        for (;;) {
            if (isWhitespace(this.#char())) this.#position++;
            else if (this.#char() === "/" && this.#char(1) === "*") {
                const close = this.#source.indexOf("*/", this.#position + 2);
                this.#position = close < 0 ? this.#end : close + 2;
            } else return this.#position > start;
        }
    }

    list(relative: boolean): SelectorList {
        const start = this.#position;
        const children: Selector[] = [];
        for (;;) {
            this.#trivia();
            children.push(this.#selector(relative));
            this.#trivia();
            if (this.#char() === ",") {
                this.#position++;
                continue;
            }
            break;
        }
        if (this.#position < this.#end && this.#char() !== ")")
            this.#error(`Unexpected \`${this.#char()}\` in selector`);
        return {
            type: "SelectorList",
            start,
            end: children.at(-1)?.end ?? start,
            children,
        };
    }

    #combinator(): Combinator | null {
        const start = this.#position;
        const char = this.#char();
        if (char === ">" || char === "+" || char === "~") {
            this.#position++;
            return {
                type: "Combinator",
                start,
                end: this.#position,
                value: char,
            };
        }
        if (char === "|" && this.#char(1) === "|") {
            this.#position += 2;
            return {
                type: "Combinator",
                start,
                end: this.#position,
                value: "||",
            };
        }
        return null;
    }

    #selector(relative: boolean): Selector {
        const start = this.#position;
        const children: CompoundSelector[] = [];
        let combinator = relative || this.#nested ? this.#combinator() : null;
        if (combinator) this.#trivia();
        for (;;) {
            const compound = this.#compound(combinator);
            if (!compound) {
                if (combinator || children.length === 0)
                    this.#error("Expected a selector");
                break;
            }
            children.push(compound);
            const before = this.#position;
            const space = this.#trivia();
            combinator = this.#combinator();
            if (combinator) this.#trivia();
            else if (space) {
                const next = this.#char();
                if (next === undefined || next === "," || next === ")") {
                    this.#position = before;
                    break;
                }
                combinator = {
                    type: "Combinator",
                    start: before,
                    end: this.#position,
                    value: " ",
                };
            } else break;
        }
        const last = children.at(-1) as CompoundSelector;
        return { type: "Selector", start, end: last.end, children };
    }

    #name(): string {
        const source = this.#source;
        const start = this.#position;
        if (this.#char() === "-") this.#position++;
        if (this.#char() === "-") this.#position++;
        for (;;) {
            const char = this.#char();
            if (isName(char)) this.#position++;
            else if (char === "\\" && this.#position + 1 < this.#end) {
                this.#position++;
                if (/[0-9a-fA-F]/.test(this.#char() ?? "")) {
                    let count = 0;
                    while (
                        count < 6 &&
                        /[0-9a-fA-F]/.test(this.#char() ?? "")
                    ) {
                        this.#position++;
                        count++;
                    }
                    if (isWhitespace(this.#char())) this.#position++;
                } else this.#position++;
            } else break;
        }
        return source.slice(start, this.#position);
    }

    #isNameStart(): boolean {
        const char = this.#char();
        if (char === "-")
            return (
                isNameStart(this.#char(1)) ||
                this.#char(1) === "-" ||
                this.#char(1) === "\\"
            );
        return isNameStart(char) || char === "\\";
    }

    #compound(combinator: Combinator | null): CompoundSelector | null {
        const start = this.#position;
        const children: SubSelector[] = [];
        let element: CompoundSelector["element"] = null;

        while (this.#char() === "&") {
            const at = this.#position;
            this.#position++;
            children.push({
                type: "NestingSelector",
                start: at,
                end: this.#position,
                suffix: "",
            });
        }

        // a type or universal selector, maybe with a namespace
        const typeStart = this.#position;
        let namespace: string | null = null;
        let name: string | null = null;
        if (
            this.#char() === "*" ||
            this.#isNameStart() ||
            (this.#char() === "|" && this.#char(1) !== "|")
        ) {
            let first: string | null = null;
            if (this.#char() === "*") {
                this.#position++;
                first = "*";
            } else if (this.#char() !== "|") first = this.#name();
            const before = this.#position;
            this.#trivia();
            if (
                this.#char() === "|" &&
                this.#char(1) !== "|" &&
                this.#char(1) !== "="
            ) {
                this.#position++;
                this.#trivia();
                namespace = first ?? "";
                if (this.#char() === "*") {
                    this.#position++;
                    name = "*";
                } else if (this.#isNameStart()) name = this.#name();
                else this.#error("Expected a name after the namespace");
            } else {
                this.#position = before;
                name = first;
            }
            if (name === "*")
                element = {
                    type: "UniversalSelector",
                    start: typeStart,
                    end: this.#position,
                    namespace,
                };
            else if (name !== null)
                element = {
                    type: "TypeSelector",
                    start: typeStart,
                    end: this.#position,
                    namespace,
                    name,
                };
        }

        for (;;) {
            const at = this.#position;
            const char = this.#char();
            if (char === "#") {
                this.#position++;
                if (!isName(this.#char()) && this.#char() !== "\\")
                    this.#error("Expected an identifier");
                const name = this.#name();
                children.push({
                    type: "IdSelector",
                    start: at,
                    end: this.#position,
                    name,
                });
            } else if (char === ".") {
                this.#position++;
                if (!this.#isNameStart()) this.#error("Expected an identifier");
                const name = this.#name();
                children.push({
                    type: "ClassSelector",
                    start: at,
                    end: this.#position,
                    name,
                });
            } else if (char === "[") children.push(this.#attribute());
            else if (char === ":") children.push(this.#pseudo());
            else if (char === "&") {
                this.#position++;
                children.push({
                    type: "NestingSelector",
                    start: at,
                    end: this.#position,
                    suffix: "",
                });
            } else break;
        }

        if (!element && children.length === 0) return null;
        return {
            type: "CompoundSelector",
            start: combinator?.start ?? start,
            end: this.#position,
            combinator,
            element,
            children,
        };
    }

    #attribute(): AttributeSelector {
        const start = this.#position;
        this.#position++;
        this.#trivia();
        let namespace: string | null = null;
        let name: string;
        if (this.#char() === "*") {
            this.#position++;
            this.#trivia();
            if (this.#char() !== "|") this.#error("Expected `|`");
            this.#position++;
            this.#trivia();
            namespace = "*";
            name = this.#name();
        } else if (this.#char() === "|") {
            this.#position++;
            this.#trivia();
            namespace = "";
            name = this.#name();
        } else {
            if (!this.#isNameStart()) this.#error("Expected an attribute name");
            name = this.#name();
            const before = this.#position;
            this.#trivia();
            if (this.#char() === "|" && this.#char(1) !== "=") {
                this.#position++;
                this.#trivia();
                namespace = name;
                name = this.#name();
            } else this.#position = before;
        }
        if (!name) this.#error("Expected an attribute name");
        this.#trivia();
        let matcher: string | null = null;
        let value: StringValue | Identifier | null = null;
        let modifier: string | null = null;
        const char = this.#char();
        if (char === "=") {
            matcher = "=";
            this.#position++;
        } else if (char && "~|^$*".includes(char) && this.#char(1) === "=") {
            matcher = `${char}=`;
            this.#position += 2;
        }
        if (matcher) {
            this.#trivia();
            const at = this.#position;
            const quote = this.#char();
            if (quote === '"' || quote === "'") {
                this.#position++;
                while (this.#char() !== undefined && this.#char() !== quote) {
                    if (this.#char() === "\\") this.#position++;
                    this.#position++;
                }
                if (this.#char() !== quote)
                    this.#error("Missing closing quote", at);
                this.#position++;
                value = {
                    type: "String",
                    start: at,
                    end: this.#position,
                    raw: this.#source.slice(at, this.#position),
                    closed: true,
                };
            } else if (this.#isNameStart() || /[0-9]/.test(quote ?? "")) {
                while (isName(this.#char()) || this.#char() === "\\") {
                    if (this.#char() === "\\") this.#position++;
                    this.#position++;
                }
                value = {
                    type: "Identifier",
                    start: at,
                    end: this.#position,
                    value: this.#source.slice(at, this.#position),
                };
            } else this.#error("Expected an attribute value");
            this.#trivia();
            if (/^[iIsS]$/.test(this.#char() ?? "") && !isName(this.#char(1))) {
                modifier = this.#char() as string;
                this.#position++;
                this.#trivia();
            }
        }
        if (this.#char() !== "]") this.#error("Expected `]`");
        this.#position++;
        return {
            type: "AttributeSelector",
            start,
            end: this.#position,
            namespace,
            name,
            matcher,
            value,
            modifier,
        };
    }

    #pseudo(): SubSelector {
        const start = this.#position;
        this.#position++;
        const element = this.#char() === ":";
        if (element) this.#position++;
        // comments and whitespace may follow the colons
        this.#trivia();
        if (!this.#isNameStart()) this.#error("Expected a pseudo name");
        const name = this.#name();
        let argument: PseudoArgument | null = null;
        // comments may come before the parenthesis, not whitespace
        const before = this.#position;
        this.#trivia();
        if (
            this.#char() !== "(" ||
            /\s/.test(
                this.#source
                    .slice(before, this.#position)
                    .replace(/\/\*[\s\S]*?\*\//g, ""),
            )
        )
            this.#position = before;
        if (this.#char() === "(") {
            this.#position++;
            const open = this.#position;
            const close = this.#closing();
            const lower = name.toLowerCase();
            this.#trivia();
            if (
                SELECTOR_PSEUDOS.has(lower) ||
                (element && /^(?:slotted|cue|-webkit-any)$/.test(lower))
            ) {
                if (this.#position >= close) {
                    if (lower !== "host" && lower !== "where" && lower !== "is")
                        this.#error("Expected a selector");
                    argument = {
                        type: "SelectorList",
                        start: close,
                        end: close,
                        children: [],
                    };
                } else {
                    argument = new SelectorParser(
                        this.#source,
                        this.#position,
                        close,
                        false,
                    ).list(lower === "has");
                }
            } else if (!element && NTH_PSEUDOS.has(lower))
                argument = this.#nth(close);
            else
                argument = {
                    type: "PseudoValues",
                    start: open,
                    end: close,
                    children: Parser.values(
                        this.#source,
                        this.#position,
                        close,
                    ),
                };
            this.#position = close + 1;
        }
        return element
            ? {
                  type: "PseudoElementSelector",
                  start,
                  end: this.#position,
                  name,
                  argument,
              }
            : {
                  type: "PseudoClassSelector",
                  start,
                  end: this.#position,
                  name,
                  argument,
              };
    }

    /** The position of the `)` closing the parentheses we are in. */
    #closing(): number {
        const source = this.#source;
        let depth = 0;
        for (let at = this.#position; at < this.#end; at++) {
            const char = source[at];
            if (char === "\\") at++;
            else if (char === '"' || char === "'") {
                at++;
                while (at < this.#end && source[at] !== char) {
                    if (source[at] === "\\") at++;
                    at++;
                }
            } else if (char === "/" && source[at + 1] === "*") {
                const close = source.indexOf("*/", at + 2);
                at = close < 0 ? this.#end : close + 1;
            } else if (char === "(") depth++;
            else if (char === ")") {
                if (depth === 0) return at;
                depth--;
            }
        }
        this.#error("Expected `)`");
    }

    #nth(close: number): Nth {
        const source = this.#source;
        const start = this.#position;
        let end = close;
        let selectors: SelectorList | null = null;
        const of = /\s+of\s+/i.exec(source.slice(start, close));
        if (of) {
            end = start + of.index;
            const parser = new SelectorParser(
                source,
                start + of.index + of[0].length,
                close,
                false,
            );
            selectors = parser.list(false);
        }
        let value = source
            .slice(start, end)
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .trim();
        end = start + source.slice(start, end).trimEnd().length;
        const compact = value.replace(/\s+/g, "").toLowerCase();
        let a: number | null = null;
        let b: number | null = null;
        if (compact === "even") [a, b] = [2, 0];
        else if (compact === "odd") [a, b] = [2, 1];
        else {
            const match = /^([+-]?\d*)n([+-]\d+)?$|^([+-]?\d+)$/.exec(compact);
            if (match) {
                if (match[3] !== undefined) [a, b] = [0, Number(match[3])];
                else {
                    const coefficient = match[1] ?? "";
                    a =
                        coefficient === "" || coefficient === "+"
                            ? 1
                            : coefficient === "-"
                              ? -1
                              : Number(coefficient);
                    b = match[2] ? Number(match[2]) : 0;
                }
            } else if (!value) this.#error("Expected An+B");
        }
        value = source.slice(start, end);
        return {
            type: "Nth",
            start,
            end: selectors?.end ?? end,
            value,
            a,
            b,
            selectors,
        };
    }
}
