import type Code from "./tokens/code.js";

export type Quote = "double" | "single";

/** Rules of every language, set for all of them or per language. */
export interface Shared {
    enabled: boolean;
    indentStyle: "space" | "tab";
    indentWidth: number;
    lineEnding: "auto" | "cr" | "crlf" | "lf";
    lineWidth: number;
    trailingNewline: boolean;
    expand: "always" | "auto" | "never";
    formatWithErrors: boolean;
    attributePosition: "auto" | "multiline";
    bracketSameLine: boolean;
    bracketSpacing: boolean;
    delimiterSpacing: boolean;
}

export interface Javascript extends Shared {
    arrowParentheses: "always" | "asNeeded";
    jsxQuoteStyle: Quote;
    operatorLinebreak: "after" | "before";
    quoteProperties: "asNeeded" | "preserve";
    quoteStyle: Quote;
    semicolons: "always" | "asNeeded";
    trailingCommas: "all" | "es5" | "none";
}

export interface Json extends Shared {
    trailingCommas: "all" | "none";
}

export interface Markdown extends Shared {
    /** Keeps the line breaks of paragraphs, wraps them at the line width, or joins them. */
    proseWrap: "always" | "never" | "preserve";
    /** Formats the code of fenced blocks in the languages formatero formats. */
    formatEmbeds: boolean;
}

/** Biome compatible rules, language sections override the shared ones. */
export interface Rules extends Shared {
    /** Globs of the files to format in order, the last match decides, "!" excludes. */
    includes: string[];
    /** Takes indentation, line ending and final newline from `.editorconfig`, under these rules. */
    useEditorconfig: boolean;
    javascript: Partial<Shared> & Omit<Javascript, keyof Shared>;
    json: Partial<Shared> & Omit<Json, keyof Shared>;
    markdown: Partial<Shared> & Omit<Markdown, keyof Shared>;
}

export interface Rule {
    apply(code: Code): void;
}
