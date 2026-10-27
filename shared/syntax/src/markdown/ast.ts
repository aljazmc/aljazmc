/** Blocks have offsets into the source and 1-based lines, inlines offsets into their block's text. */
interface Base<T extends string> {
    type: T;
    start: number;
    end: number;
}

interface BlockBase<T extends string> extends Base<T> {
    /** The first and last line with content, blank lines around are not part of a block. */
    line: number;
    endLine: number;
}

export interface Root extends BlockBase<"Root"> {
    /** Whether the source starts with a byte order mark. */
    bom: boolean;
    /** The raw front matter, with its `---` fences, when parsing it is enabled. */
    frontmatter: Frontmatter | null;
    children: Block[];
}

export interface Frontmatter extends BlockBase<"Frontmatter"> {
    raw: string;
}

export interface Heading extends BlockBase<"Heading"> {
    level: number;
    /** `Title\n=====` rather than `# Title`. */
    setext: boolean;
    /** The content, without the markers and the indentation of each line. */
    text: string;
    /** The `===` or `---` line of setext headings, trimmed. */
    underline: string;
    children: Inline[];
}

export interface Paragraph extends BlockBase<"Paragraph"> {
    /** The lines joined by `\n`, without the indentation of each line. */
    text: string;
    /** The indentation of each line, after the prefixes of containers. */
    indents: string[];
    /** What precedes each line in the source, like the indentation of a list item or `> `. */
    prefixes: string[];
    /** Whether each line continues the paragraph lazily, without the prefixes of its containers. */
    lazy: boolean[];
    children: Inline[];
}

export interface ThematicBreak extends BlockBase<"ThematicBreak"> {
    /** The line as written, without indentation, like `* * *`. */
    raw: string;
}

export interface CodeBlock extends BlockBase<"CodeBlock"> {
    /** The opening fence, like "```" or "~~~~", or "" for indented code. */
    fence: string;
    /** The columns the opening fence is indented by. */
    indent: number;
    /** The info string, trimmed. */
    info: string;
    /** The lines of code, after the container prefixes, indented code without its four columns. */
    lines: string[];
    /** What precedes each line in the source, like the indentation of a list item or `> `. */
    prefixes: string[];
    /** Whether a fenced block has its closing fence. */
    closed: boolean;
}

export interface HtmlBlock extends BlockBase<"HtmlBlock"> {
    /** The CommonMark start condition, 1 to 7. */
    kind: number;
    lines: string[];
}

export interface Definition extends BlockBase<"Definition"> {
    /** The indentation before the label. */
    indent: string;
    label: string;
    destination: string;
    /** The title with its quotes or parentheses, if any. */
    title: string | null;
}

export interface BlockQuote extends BlockBase<"BlockQuote"> {
    children: Block[];
}

export interface List extends BlockBase<"List"> {
    ordered: boolean;
    /** `-`, `*` or `+`, or the delimiter of ordered lists, `.` or `)`. */
    delimiter: string;
    /** Whether blank lines separate no items and no blocks of an item. */
    tight: boolean;
    children: ListItem[];
}

export interface ListItem extends BlockBase<"ListItem"> {
    /** The marker as written, like `-` or `01.`. */
    marker: string;
    /** The number of ordered items. */
    number: number | null;
    /** Columns before the marker. */
    indent: number;
    /** Spaces after the marker as written, before the content, at least 1 unless the item is empty. */
    spaces: number;
    /** Task list items, `[ ]` or `[x]`, have their state, the box stays in the first paragraph. */
    checked: boolean | null;
    children: Block[];
}

export type Alignment = "left" | "center" | "right" | null;

export interface Table extends BlockBase<"Table"> {
    alignments: Alignment[];
    /** The header first, then the body rows, without the delimiter row. */
    rows: TableRow[];
}

export interface TableRow extends BlockBase<"TableRow"> {
    cells: TableCell[];
}

export interface TableCell extends Base<"TableCell"> {
    text: string;
    children: Inline[];
}

export type Block =
    | BlockQuote
    | CodeBlock
    | Definition
    | Heading
    | HtmlBlock
    | List
    | Paragraph
    | Table
    | ThematicBreak;

export interface Text extends Base<"Text"> {
    /** As written, with escapes and entities. */
    raw: string;
}

export interface Break extends Base<"Break"> {
    /** A hard break, two spaces or a backslash before the line ending. */
    hard: boolean;
    raw: string;
}

export interface Code extends Base<"Code"> {
    raw: string;
}

/** `*a*`, `**a**` and `~~a~~` with their delimiters, like `_` or `**`. */
export interface Emphasis extends Base<"Emphasis"> {
    delimiter: string;
    children: Inline[];
}

export interface Strong extends Base<"Strong"> {
    delimiter: string;
    children: Inline[];
}

export interface Strikethrough extends Base<"Strikethrough"> {
    delimiter: string;
    children: Inline[];
}

export interface Link extends Base<"Link" | "Image"> {
    children: Inline[];
    /** From `[text](` to the end. */
    tail: string;
    /** Inline links have a destination, others a label, like `[a][b]`, `[a][]` and `[a]`. */
    reference: "full" | "collapsed" | "shortcut" | null;
    /** The label of references, with its brackets. */
    label: string | null;
    destination: string;
    title: string | null;
}

export interface Autolink extends Base<"Autolink"> {
    raw: string;
}

export interface Html extends Base<"Html"> {
    raw: string;
}

export type Inline =
    | Autolink
    | Break
    | Code
    | Emphasis
    | Html
    | Link
    | Strikethrough
    | Strong
    | Text;

export type Node =
    | Root
    | Frontmatter
    | Block
    | ListItem
    | TableRow
    | TableCell
    | Inline;
