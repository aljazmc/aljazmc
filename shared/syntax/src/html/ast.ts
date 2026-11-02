/** Nodes have offsets into the source, `end` is exclusive. */
interface Base<T extends string> {
    type: T;
    start: number;
    end: number;
}

export interface Root extends Base<"Root"> {
    /** Whether the source starts with a byte order mark. */
    bom: boolean;
    /** A leading processing instruction, like `<?xml version="1.0"?>`. */
    instruction: Instruction | null;
    doctype: Doctype | null;
    children: Child[];
    /** Every `<!-- -->` comment, in source order. Comments are not children. */
    comments: Comment[];
}

/** What elements contain. Whitespace and comments between them are not nodes. */
export type Child = Element | Text | Cdata;

export interface Element extends Base<"Element"> {
    /** The name as written, like `DIV` or `my-element`. */
    name: string;
    /** The known tag the name matches, like `div` for `DIV`, null for custom and unknown elements. */
    tag: string | null;
    attributes: Attribute[];
    /** The end of the opening tag, after its `>`. */
    openingEnd: number;
    /** Written with `/` before `>`. */
    selfClosing: boolean;
    /** The closing tag, null for self-closing and void elements. */
    closing: ClosingTag | null;
    /** Script, style and preformatted elements hold their content as one raw text. */
    raw: boolean;
    children: Child[];
}

export interface ClosingTag extends Base<"ClosingTag"> {
    /** The name as written. */
    name: string;
}

export interface Attribute extends Base<"Attribute"> {
    /** The name as written. */
    name: string;
    /** The end of the name. */
    nameEnd: number;
    value: AttributeValue | null;
}

export interface AttributeValue extends Base<"AttributeValue"> {
    /** As written, with its quotes. */
    raw: string;
    /** Without its quotes, character references are not decoded. */
    text: string;
    quote: '"' | "'" | "";
}

/**
 * A run of text, without the whitespace around it, which is trivia like in
 * Biome. A blank line ends a text, the next one starts after it.
 */
export interface Text extends Base<"Text"> {
    /** The text as written, character references are not decoded. */
    value: string;
}

export interface Cdata extends Base<"Cdata"> {
    /** As written, with `<![CDATA[` and `]]>`. */
    value: string;
}

export interface Comment extends Base<"Comment"> {
    /** As written, with `<!--` and `-->`. */
    value: string;
}

export interface Doctype extends Base<"Doctype"> {
    /** The keyword as written, like `DOCTYPE`, or another word of a declaration that is no doctype. */
    keyword: string;
    /** The document type as written, like `html`, or null. */
    name: string | null;
    /** A word after the name, like `PUBLIC`. */
    literal: string | null;
    /** The quoted identifiers, as written. */
    identifiers: string[];
}

export interface Instruction extends Base<"Instruction"> {
    /** The name as written, like `xml`. */
    name: string;
    attributes: Attribute[];
}

export type Node =
    | Root
    | Element
    | ClosingTag
    | Attribute
    | AttributeValue
    | Text
    | Cdata
    | Comment
    | Doctype
    | Instruction;
