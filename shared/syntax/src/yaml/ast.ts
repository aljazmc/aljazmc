/** A `#` comment, its value starting with the `#`. */
export interface Comment {
    start: number;
    end: number;
    value: string;
}

/** A comment on a line of its own, after a blank line or not. */
export interface CommentLine {
    comment: Comment;
    blank: boolean;
}

interface Base {
    start: number;
    end: number;
    /** Tag and anchor, like `!!str &a`, the tag first, separated by a single space. */
    properties?: string;
    /** The comment after properties standing alone on their line. */
    propertiesComment?: Comment;
    /** Comments on their own lines between such properties and the node. */
    leading?: CommentLine[];
    /** The comment after the node on its last line. */
    comment?: Comment;
}

/** A plain, single or double quoted scalar. */
export interface Scalar extends Base {
    type: "Scalar";
    style: "plain" | "single" | "double";
    /** Its lines without their indentation and trailing spaces, quotes included, blank lines empty. */
    lines: string[];
}

/** A literal `|` or folded `>` scalar. */
export interface BlockScalar extends Base {
    type: "BlockScalar";
    /** Like `|`, `>-` or `|2+`. */
    header: string;
    /** The explicit indentation indicator, 0 without one. */
    indicator: number;
    /** The indentation of the node the scalar belongs to, -1 for a document's own. */
    parent: number;
    /** The indentation of its content. */
    indentation: number;
    /** Its content lines as written, with their indentation. */
    lines: string[];
}

export interface Alias extends Base {
    type: "Alias";
    /** Like `*a`. */
    name: string;
}

/** An entry of a flow collection, a pair like `a: 1` or a single node, which is its key. */
export interface FlowItem {
    key: Node | null;
    value: Node | null;
    /** Whether it has a `:`. */
    pair: boolean;
    /** Comments after it, before the next one. */
    comments: Comment[];
}

export interface FlowMapping extends Base {
    type: "FlowMapping";
    items: FlowItem[];
    /** Comments before the first item. */
    opening: Comment[];
}

export interface FlowSequence extends Base {
    type: "FlowSequence";
    items: FlowItem[];
    opening: Comment[];
}

/** What block mapping entries and sequence items share. */
interface Entry {
    /** Comments on their own lines before it, at its indentation. */
    leading: CommentLine[];
    /** Whether a blank line comes before it, after its leading comments. */
    blank: boolean;
    value: Node | null;
    /** The comment after its indicator, `:` or `-`, when the value is on the lines after it. */
    comment?: Comment;
    /** Comments on their own lines between the indicator and a value on the lines after it. */
    between: CommentLine[];
    /** Whether a blank line comes before such a value, after those comments. */
    betweenBlank: boolean;
    /** Comments indented deeper than it after its value, which is not a block scalar. */
    inner: CommentLine[];
}

export interface MappingEntry extends Entry {
    key: Node | null;
    /** Whether the key is written after `?`. */
    explicit: boolean;
    /** The comment after `?` when the key is on the lines after it. */
    keyComment?: Comment;
    /** Comments on their own lines around an explicit key. */
    keyBetween: CommentLine[];
}

export type SequenceItem = Entry;

export interface Mapping extends Base {
    type: "Mapping";
    entries: MappingEntry[];
    /** Comments at its indentation after its last entry. */
    endComments: CommentLine[];
}

export interface Sequence extends Base {
    type: "Sequence";
    items: SequenceItem[];
    endComments: CommentLine[];
}

export type Node =
    | Scalar
    | BlockScalar
    | Alias
    | FlowMapping
    | FlowSequence
    | Mapping
    | Sequence;

/** A comment or a directive, like `%YAML 1.2`, before a document starts. */
export interface Prelude {
    text: string;
    blank: boolean;
}

export interface Document {
    type: "Document";
    start: number;
    end: number;
    prelude: Prelude[];
    /** Whether it starts with `---`. */
    explicitStart: boolean;
    /** Whether a blank line comes before `---`, after the prelude. */
    startBlank: boolean;
    /** The comment after `---`. */
    startComment?: Comment;
    /** Comments before its node, after `---`. */
    leading: CommentLine[];
    /** Whether a blank line comes before its node, after those comments. */
    blank: boolean;
    root: Node | null;
    /** Comments after its node. */
    trailing: CommentLine[];
    /** Whether it ends with `...`. */
    explicitEnd: boolean;
    /** The comment after `...`. */
    endComment?: Comment;
}

export interface Stream {
    type: "Stream";
    documents: Document[];
}
