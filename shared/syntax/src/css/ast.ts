/** Nodes have offsets into the source, `end` is exclusive. */
interface Base<T extends string> {
    type: T;
    start: number;
    end: number;
}

export interface Stylesheet extends Base<"Stylesheet"> {
    /** Whether the source starts with a byte order mark. */
    bom: boolean;
    children: Statement[];
    /** Every `/* *\/` comment, in source order. Comments are not children. */
    comments: Comment[];
    /** Syntax errors a parser that recovers skipped, the items with them are left out. */
    errors: { message: string; position: number }[];
}

/** What a stylesheet contains at its top level. */
export type Statement = Rule | AtRule | Empty;

/** What a block contains: declarations, and nested rules and at-rules. */
export type Item = Declaration | Rule | AtRule | Empty;

/** A rule with selectors, like `a > b { color: red }`, or a keyframe, like `from { }`. */
export interface Rule extends Base<"Rule"> {
    /** The selectors before the block, nested ones may start with a combinator, null for keyframes. */
    selectors: SelectorList | null;
    /** The values before the block, the selectors of keyframes, like `from, 50%`. */
    prelude: Value[];
    block: Block;
}

/** An at-rule, like `@media screen { }` or `@import "a.css";`. */
export interface AtRule extends Base<"AtRule"> {
    /** The name as written, without `@`. */
    name: string;
    /** The name in lower case, for matching. */
    keyword: string;
    /** The values between the name and the block or semicolon. */
    prelude: Value[];
    /** The start and end of the prelude, without the whitespace around it. */
    preludeStart: number;
    preludeEnd: number;
    block: Block | null;
    /** Ends with `;`, a statement at the end of a block or file may not. */
    semicolon: boolean;
}

export interface Block extends Base<"Block"> {
    children: Item[];
}

/** A `;` on its own. */
export type Empty = Base<"Empty">;

export interface Declaration extends Base<"Declaration"> {
    /** The property as written, like `COLOR` or `--main-color`. */
    property: string;
    /** The end of the property name. */
    propertyEnd: number;
    /** The position of the `:`. */
    colon: number;
    /** The values after the `:`, without `!important`. */
    value: Value[];
    /** `!important`, as written, like `! IMPORTANT`. */
    important: Important | null;
    /** Ends with `;`, the last declaration of a block may not. */
    semicolon: boolean;
}

export interface Important extends Base<"Important"> {
    /** The keyword as written, like `important`. */
    keyword: string;
}

/** Component values, the parts of property values and at-rule preludes. */
export type Value =
    | Identifier
    | FunctionValue
    | NumberValue
    | Percentage
    | Dimension
    | StringValue
    | Url
    | Hash
    | Delimiter
    | Comma
    | Colon
    | Semicolon
    | SimpleBlock
    | UnicodeRange
    | AtKeyword;

export interface Identifier extends Base<"Identifier"> {
    /** As written, escapes are not decoded. */
    value: string;
}

export interface FunctionValue extends Base<"Function"> {
    /** The name as written, without `(`. */
    name: string;
    /** The position of the `(`. */
    open: number;
    children: Value[];
    /** Whether the `)` is written, a function at the end of a file may miss it. */
    closed: boolean;
}

export interface NumberValue extends Base<"Number"> {
    /** As written, like `+.5` or `1e3`. */
    value: string;
}

export interface Percentage extends Base<"Percentage"> {
    /** The number as written, without `%`. */
    value: string;
}

export interface Dimension extends Base<"Dimension"> {
    /** The number as written. */
    value: string;
    /** The unit as written, like `PX`. */
    unit: string;
}

export interface StringValue extends Base<"String"> {
    /** As written, with its quotes. */
    raw: string;
    /** Whether the string ends with its quote, a newline or the end of the file end unclosed ones. */
    closed: boolean;
}

/** `url(…)`, with an unquoted or a quoted address. */
export interface Url extends Base<"Url"> {
    /** The name as written, like `URL`. */
    name: string;
    /** The address, a raw text or a string, or null for `url()`. */
    value: StringValue | UrlRaw | null;
    /** Values after a quoted address, like `url("a" format("b"))`. */
    modifiers: Value[];
}

/** An unquoted address in `url(…)`. */
export interface UrlRaw extends Base<"UrlRaw"> {
    /** As written, without the whitespace around it. */
    value: string;
}

export interface Hash extends Base<"Hash"> {
    /** As written, without `#`. */
    value: string;
}

/** A single character that is no other token, like `/`, `+`, `>` or `!`. */
export interface Delimiter extends Base<"Delimiter"> {
    value: string;
}

export type Comma = Base<"Comma">;

export type Colon = Base<"Colon">;

export type Semicolon = Base<"Semicolon">;

/** Values in parentheses, brackets or braces. */
export interface SimpleBlock extends Base<"SimpleBlock"> {
    open: "(" | "[" | "{";
    children: Value[];
    /** Whether the closing bracket is written. */
    closed: boolean;
}

export interface UnicodeRange extends Base<"UnicodeRange"> {
    /** As written, like `U+0025-00FF`. */
    value: string;
}

export interface AtKeyword extends Base<"AtKeyword"> {
    /** As written, without `@`. */
    value: string;
}

export interface Comment extends Base<"Comment"> {
    /** As written, with `/*` and `*\/`. */
    value: string;
}

/** Selectors separated by commas. */
export interface SelectorList extends Base<"SelectorList"> {
    children: Selector[];
}

/**
 * Compound selectors joined by combinators. The first may have a combinator
 * too, in nested rules and in `:has()`.
 */
export interface Selector extends Base<"Selector"> {
    children: CompoundSelector[];
}

/** Simple selectors written together, like `&div.a:hover`. */
export interface CompoundSelector extends Base<"CompoundSelector"> {
    /** The combinator before it, null for the first one without a combinator. */
    combinator: Combinator | null;
    /** The type or universal selector, first after the nesting selectors. */
    element: TypeSelector | UniversalSelector | null;
    children: SubSelector[];
}

export interface Combinator extends Base<"Combinator"> {
    /** `>`, `+`, `~`, `||`, or " " for descendants. */
    value: ">" | "+" | "~" | "||" | " ";
}

export interface TypeSelector extends Base<"TypeSelector"> {
    /** The namespace prefix as written, like `svg` of `svg|a` or `*`, "" for `|a`, null without `|`. */
    namespace: string | null;
    /** The name as written. */
    name: string;
}

export interface UniversalSelector extends Base<"UniversalSelector"> {
    namespace: string | null;
}

export type SubSelector =
    | NestingSelector
    | IdSelector
    | ClassSelector
    | AttributeSelector
    | PseudoClassSelector
    | PseudoElementSelector;

export interface NestingSelector extends Base<"NestingSelector"> {
    /** A suffix written right after the `&`, like `-a` of `&-a`. */
    suffix: string;
}

export interface IdSelector extends Base<"IdSelector"> {
    /** As written, without `#`. */
    name: string;
}

export interface ClassSelector extends Base<"ClassSelector"> {
    /** As written, without `.`. */
    name: string;
}

export interface AttributeSelector extends Base<"AttributeSelector"> {
    namespace: string | null;
    /** The attribute name as written. */
    name: string;
    /** `=`, `~=`, `|=`, `^=`, `$=` or `*=`, null without a value. */
    matcher: string | null;
    /** The value, a string or an identifier as written. */
    value: StringValue | Identifier | null;
    /** `i` or `s`, as written. */
    modifier: string | null;
}

export interface PseudoClassSelector extends Base<"PseudoClassSelector"> {
    /** The name as written, without `:`. */
    name: string;
    /** What is between its parentheses, null without them. */
    argument: PseudoArgument | null;
}

export interface PseudoElementSelector extends Base<"PseudoElementSelector"> {
    /** The name as written, without `::`. */
    name: string;
    argument: PseudoArgument | null;
}

/** Selectors for `:is()` and the like, An+B for `:nth-child()`, values for others. */
export type PseudoArgument = SelectorList | Nth | PseudoValues;

/** An+B, optionally `of` selectors. */
export interface Nth extends Base<"Nth"> {
    /** The An+B part, like `2n+1`, `even` or `-n + 3`, as written. */
    value: string;
    /** The coefficient and offset, null for an invalid one. */
    a: number | null;
    b: number | null;
    selectors: SelectorList | null;
}

/** Other arguments of pseudo classes and elements, like of `:lang()` or `::part()`. */
export interface PseudoValues extends Base<"PseudoValues"> {
    children: Value[];
}

export type Node =
    | Stylesheet
    | Rule
    | AtRule
    | Block
    | Empty
    | Declaration
    | Important
    | Value
    | UrlRaw
    | Comment
    | SelectorList
    | Selector
    | CompoundSelector
    | Combinator
    | TypeSelector
    | UniversalSelector
    | SubSelector
    | Nth
    | PseudoValues;
