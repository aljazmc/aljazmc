import { ParseError } from "../scanner.js";
import type {
    Attribute,
    AttributeValue,
    Child,
    Comment,
    Doctype,
    Element,
    Instruction,
    Root,
} from "./ast.js";
import { tagNames } from "./tags.js";

/** Elements without content or closing tag. */
const VOID = new Set([
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
]);

/** Elements whose content is raw text: embedded languages and preformatted text. */
const RAW = new Set(["script", "style", "pre", "textarea", "xmp", "plaintext"]);

const isWhitespace = (char: string | undefined) =>
    char === " " || char === "\t" || char === "\n" || char === "\r";

/** ASCII letters and digits, `-`, `_` and `:`, and `.` like Prettier. */
const isTagNameChar = (char: string | undefined) =>
    char !== undefined && /^[A-Za-z0-9_:.-]$/.test(char);

/** Printable ASCII but whitespace, quotes, `<`, `>`, `/` and `=`. */
const isAttributeNameChar = (char: string | undefined) =>
    char !== undefined &&
    char.charCodeAt(0) < 0x7f &&
    char.charCodeAt(0) > 0x1f &&
    !/[ \t\n"'<>/=]/.test(char);

/** The known tag a name matches, exactly like SVG's `feBlend`, or lower-cased like HTML's `DIV`. */
export function tagOf(name: string): string | null {
    if (tagNames.has(name)) return name;
    const lower = name.toLowerCase();
    return tagNames.has(lower) ? lower : null;
}

/**
 * Parses HTML: elements are closed explicitly, only void ones may
 * have no closing tag, and whitespace and comments are trivia between nodes.
 */
export default class Parser {
    readonly #source: string;
    #position = 0;
    readonly #comments: Comment[] = [];

    constructor(source: string) {
        this.#source = source;
    }

    /** Where the parser is. */
    get position(): number {
        return this.#position;
    }

    parse(): Root {
        const source = this.#source;
        const bom = source.startsWith("\uFEFF");
        if (bom) this.#position = 1;

        // only Astro files have front matter
        if (source.startsWith("---", this.#position))
            this.#error("Frontmatter is only valid inside Astro files.");
        this.#trivia();
        const instruction = source.startsWith("<?", this.#position)
            ? this.#instruction()
            : null;
        this.#trivia();
        const doctype =
            source.startsWith("<!", this.#position) &&
            !source.startsWith("<!--", this.#position) &&
            !source.startsWith("<![CDATA[", this.#position)
                ? this.#doctype()
                : null;
        const children = this.#children(null);
        return {
            type: "Root",
            start: 0,
            end: source.length,
            bom,
            instruction,
            doctype,
            children,
            comments: this.#comments,
        };
    }

    #error(message: string, position = this.#position): never {
        throw new ParseError(message, position);
    }

    /** Skips whitespace and comments. */
    #trivia(): void {
        const source = this.#source;
        for (;;) {
            while (isWhitespace(source[this.#position])) this.#position++;
            if (!source.startsWith("<!--", this.#position)) return;
            const start = this.#position;
            const close = source.indexOf("-->", start + 4);
            // an unterminated comment runs to the end of the file
            this.#position = close < 0 ? source.length : close + 3;
            this.#comments.push({
                type: "Comment",
                start,
                end: this.#position,
                value: source.slice(start, this.#position),
            });
        }
    }

    /** Children up to the closing tag of `parent`, or the end of the file at the root. */
    #children(parent: Element | null): Child[] {
        const source = this.#source;
        const children: Child[] = [];
        for (;;) {
            this.#trivia();
            if (this.#position >= source.length) {
                if (parent)
                    this.#error(
                        "Expected a closing tag but instead found the end of the file.",
                    );
                return children;
            }
            if (source[this.#position] !== "<") {
                children.push(this.#text());
                continue;
            }
            if (source.startsWith("</", this.#position)) {
                const start = this.#position;
                const name = this.#closingName();
                // the element reads its closing tag
                this.#position = start;
                if (VOID.has(tagOf(name) ?? ""))
                    this.#error(
                        "Void elements should not have a closing tag. Remove the closing tag.",
                        start,
                    );
                if (!parent)
                    this.#error(
                        "This closing tag has no matching opening tag.",
                        start,
                    );
                if (name.toLowerCase() !== parent.name.toLowerCase())
                    this.#error(
                        `Expected a matching closing tag but instead found '${source.slice(start, this.#closingEnd(start))}'.`,
                        start,
                    );
                return children;
            }
            if (source.startsWith("<![CDATA[", this.#position)) {
                const start = this.#position;
                const close = source.indexOf("]]>", start);
                if (close < 0)
                    this.#error("Unterminated CDATA section.", start);
                this.#position = close + 3;
                children.push({
                    type: "Cdata",
                    start,
                    end: this.#position,
                    value: source.slice(start, this.#position),
                });
                continue;
            }
            if (source[this.#position + 1] === "!")
                this.#error(
                    "Expected an element name but instead found '!'.",
                    this.#position + 1,
                );
            if (!/[A-Za-z]/.test(source[this.#position + 1] ?? ""))
                this.#error(
                    "Unescaped `<` bracket character. Expected a tag or escaped character.",
                );
            children.push(this.#element());
        }
    }

    /** Text up to `<`, without trailing whitespace, ending at a blank line unless it has braces. */
    #text(): Child {
        const source = this.#source;
        const start = this.#position;
        let whitespace: number | undefined;
        let newlines = 0;
        let curly = false;
        while (this.#position < source.length) {
            const char = source[this.#position];
            if (char === "<") break;
            if (char === "\n" || char === "\r") {
                whitespace ??= this.#position;
                newlines++;
                if (newlines > 1 && !curly) break;
            } else if (char === " " || char === "\t") {
                whitespace ??= this.#position;
            } else {
                if (char === "{" || char === "}") curly = true;
                whitespace = undefined;
                newlines = 0;
            }
            this.#position++;
        }
        if (whitespace !== undefined) this.#position = whitespace;
        return {
            type: "Text",
            start,
            end: this.#position,
            value: source.slice(start, this.#position),
        };
    }

    #element(): Element {
        const source = this.#source;
        const start = this.#position;
        this.#position++;
        const nameStart = this.#position;
        while (isTagNameChar(source[this.#position])) this.#position++;
        const name = source.slice(nameStart, this.#position);
        const tag = tagOf(name);
        const attributes = this.#attributes();

        const element: Element = {
            type: "Element",
            start,
            end: 0,
            name,
            tag,
            attributes,
            openingEnd: 0,
            selfClosing: false,
            closing: null,
            raw: false,
            children: [],
        };

        if (source[this.#position] === "/") {
            this.#position++;
            this.#expect(">");
            element.selfClosing = true;
            element.openingEnd = element.end = this.#position;
            return element;
        }
        this.#expect(">");
        element.openingEnd = this.#position;
        if (VOID.has(tag ?? "")) {
            element.end = this.#position;
            return element;
        }

        if (RAW.has(tag ?? "")) {
            element.raw = true;
            const contentStart = this.#position;
            const pattern = new RegExp(`</${name}[\\s>/]`, "iy");
            while (this.#position < source.length) {
                pattern.lastIndex = this.#position;
                if (pattern.test(source)) break;
                this.#position++;
            }
            if (this.#position > contentStart)
                element.children.push({
                    type: "Text",
                    start: contentStart,
                    end: this.#position,
                    value: source.slice(contentStart, this.#position),
                });
            if (this.#position >= source.length)
                this.#error(
                    "Expected a closing tag but instead found the end of the file.",
                );
        } else element.children = this.#children(element);

        const closingStart = this.#position;
        const closingName = this.#closingName();
        this.#position = this.#closingEnd(closingStart);
        element.closing = {
            type: "ClosingTag",
            start: closingStart,
            end: this.#position,
            name: closingName,
        };
        element.end = this.#position;
        return element;
    }

    /** The name of the closing tag at the position, leaving the position after it. */
    #closingName(): string {
        const source = this.#source;
        this.#position += 2;
        const start = this.#position;
        while (isTagNameChar(source[this.#position])) this.#position++;
        return source.slice(start, this.#position);
    }

    /** The end of the closing tag starting at `start`, after its `>`. */
    #closingEnd(start: number): number {
        const source = this.#source;
        let position = start + 2;
        while (isTagNameChar(source[position])) position++;
        while (isWhitespace(source[position])) position++;
        if (source[position] !== ">")
            this.#error("Expected a `>` to end the closing tag.", position);
        return position + 1;
    }

    #expect(char: string): void {
        if (this.#source[this.#position] !== char)
            this.#error(
                this.#position >= this.#source.length
                    ? `Expected \`${char}\` but instead found the end of the file.`
                    : `Expected \`${char}\` but instead found \`${this.#source[this.#position]}\`.`,
            );
        this.#position++;
    }

    /** Attributes up to `>`, `/` or `?`. */
    #attributes(): Attribute[] {
        const source = this.#source;
        const attributes: Attribute[] = [];
        for (;;) {
            while (isWhitespace(source[this.#position])) this.#position++;
            const char = source[this.#position];
            if (
                char === undefined ||
                char === ">" ||
                char === "/" ||
                (char === "?" && source[this.#position + 1] === ">")
            )
                return attributes;
            if (!isAttributeNameChar(char))
                this.#error(`Unexpected character \`${char}\`.`);
            const start = this.#position;
            while (isAttributeNameChar(source[this.#position])) {
                if (
                    source[this.#position] === "?" &&
                    source[this.#position + 1] === ">"
                )
                    break;
                this.#position++;
            }
            const nameEnd = this.#position;
            const attribute: Attribute = {
                type: "Attribute",
                start,
                end: nameEnd,
                name: source.slice(start, nameEnd),
                nameEnd,
                value: null,
            };
            let after = this.#position;
            while (isWhitespace(source[after])) after++;
            if (source[after] === "=") {
                this.#position = after + 1;
                while (isWhitespace(source[this.#position])) this.#position++;
                attribute.value = this.#value();
                attribute.end = attribute.value.end;
            }
            attributes.push(attribute);
        }
    }

    #value(): AttributeValue {
        const source = this.#source;
        const start = this.#position;
        const quote = source[start];
        if (quote === '"' || quote === "'") {
            const close = source.indexOf(quote, start + 1);
            if (close < 0) this.#error("Missing closing quote", start);
            this.#position = close + 1;
            return {
                type: "AttributeValue",
                start,
                end: this.#position,
                raw: source.slice(start, this.#position),
                text: source.slice(start + 1, close),
                quote,
            };
        }
        while (this.#position < source.length) {
            const char = source[this.#position] as string;
            if (isWhitespace(char) || char === ">") break;
            if (/[?'"=<`]/.test(char) || char.charCodeAt(0) > 0x7f)
                this.#error("Unexpected character in unquoted attribute value");
            this.#position++;
        }
        if (this.#position === start)
            this.#error("Unexpected character in unquoted attribute value");
        const raw = source.slice(start, this.#position);
        return {
            type: "AttributeValue",
            start,
            end: this.#position,
            raw,
            text: raw,
            quote: "",
        };
    }

    /** `<!DOCTYPE html>`, or with a literal and quoted identifiers. */
    #doctype(): Doctype {
        const source = this.#source;
        const start = this.#position;
        this.#position += 2;
        const word = () => {
            while (isWhitespace(source[this.#position])) this.#position++;
            const from = this.#position;
            while (
                this.#position < source.length &&
                !isWhitespace(source[this.#position]) &&
                !/[>"']/.test(source[this.#position] as string)
            )
                this.#position++;
            return from < this.#position
                ? source.slice(from, this.#position)
                : null;
        };
        // any `<!` declaration starting the file is read like a doctype
        const keyword = word() ?? "";
        const name = word();
        const literal = word();
        const identifiers: string[] = [];
        for (let index = 0; index < 2; index++) {
            while (isWhitespace(source[this.#position])) this.#position++;
            const quote = source[this.#position];
            if (quote !== '"' && quote !== "'") break;
            const close = source.indexOf(quote, this.#position + 1);
            if (close < 0) this.#error("Missing closing quote");
            identifiers.push(source.slice(this.#position, close + 1));
            this.#position = close + 1;
        }
        while (isWhitespace(source[this.#position])) this.#position++;
        this.#expect(">");
        return {
            type: "Doctype",
            start,
            end: this.#position,
            keyword,
            name,
            literal,
            identifiers,
        };
    }

    /** `<?xml version="1.0"?>` at the start of a file. */
    #instruction(): Instruction {
        const source = this.#source;
        const start = this.#position;
        this.#position += 2;
        const nameStart = this.#position;
        while (isAttributeNameChar(source[this.#position])) {
            if (source.startsWith("?>", this.#position)) break;
            this.#position++;
        }
        const name = source.slice(nameStart, this.#position);
        const attributes = this.#attributes();
        if (!source.startsWith("?>", this.#position))
            this.#error("Expected `?>` to end the processing instruction.");
        this.#position += 2;
        return {
            type: "Instruction",
            start,
            end: this.#position,
            name,
            attributes,
        };
    }
}
