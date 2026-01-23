export type Kind =
    | "comment"
    | "jsx"
    | "jsxString"
    | "jsxText"
    | "newline"
    | "punct"
    | "regex"
    | "space"
    | "string"
    | "template"
    | "word";

export type Bracket =
    | "arrow"
    | "block"
    | "call"
    | "children"
    | "enum"
    | "expression"
    | "group"
    | "header"
    | "list"
    | "object"
    | "switch"
    | "tag";

export interface Token {
    kind: Kind;
    value: string;
    /** Set on opening brackets. */
    bracket?: Bracket;
    /** Significant token before an opening bracket. */
    before?: Token;
    /** Set on closing brackets: the matching opening bracket. */
    open?: Token;
    /** Innermost opening bracket enclosing the token. */
    parent?: Token;
}
