/**
 * Documents describe printed code with its possible line breaks,
 * after Wadler's "A prettier printer" as popularized by Prettier.
 */
export type Doc = string | Doc[] | Command;

export type Command =
    | Reserve
    | Align
    | BreakParent
    | Fill
    | Group
    | IfBreak
    | Indent
    | IndentIfBreak
    | Label
    | Line
    | LineSuffix
    | LineSuffixBoundary;

/** Prints nothing, but takes columns when measuring whether content fits. */
export interface Reserve {
    type: "reserve";
    width: number;
}

export interface Group {
    type: "group";
    contents: Doc;
    break: boolean;
    id?: symbol;
    /** Alternatives tried in order when the group does not fit flat. */
    expandedStates?: Doc[];
}

export interface Indent {
    type: "indent";
    contents: Doc;
}

export interface Align {
    type: "align";
    contents: Doc;
    /** Spaces to add, or -1 to remove one indentation level. */
    width: number;
}

export interface Line {
    type: "line";
    hard?: boolean;
    soft?: boolean;
    literal?: boolean;
}

export interface IfBreak {
    type: "if-break";
    breakContents: Doc;
    flatContents: Doc;
    groupId?: symbol;
}

export interface IndentIfBreak {
    type: "indent-if-break";
    contents: Doc;
    groupId: symbol;
}

export interface Fill {
    type: "fill";
    parts: Doc[];
}

export interface LineSuffix {
    type: "line-suffix";
    contents: Doc;
}

export interface LineSuffixBoundary {
    type: "line-suffix-boundary";
}

export interface BreakParent {
    type: "break-parent";
}

export interface Label {
    type: "label";
    label: string;
    contents: Doc;
}

export const line: Line = { type: "line" };
export const softline: Line = { type: "line", soft: true };
export const breakParent: BreakParent = { type: "break-parent" };
export const hardline: Doc = [{ type: "line", hard: true }, breakParent];
export const literalline: Doc = [
    { type: "line", hard: true, literal: true },
    breakParent,
];
export const lineSuffixBoundary: LineSuffixBoundary = {
    type: "line-suffix-boundary",
};

export function reserve(width: number): Reserve {
    return { type: "reserve", width };
}

export function group(
    contents: Doc,
    options: { shouldBreak?: boolean; id?: symbol } = {},
): Group {
    const doc: Group = {
        type: "group",
        contents,
        break: options.shouldBreak ?? false,
    };
    if (options.id) doc.id = options.id;
    return doc;
}

export function conditionalGroup(
    states: Doc[],
    options: { shouldBreak?: boolean } = {},
): Group {
    return {
        type: "group",
        contents: states[0] ?? "",
        break: options.shouldBreak ?? false,
        expandedStates: states,
    };
}

export function indent(contents: Doc): Indent {
    return { type: "indent", contents };
}

export function align(width: number, contents: Doc): Align {
    return { type: "align", contents, width };
}

export function dedent(contents: Doc): Align {
    return align(-1, contents);
}

export function ifBreak(
    breakContents: Doc,
    flatContents: Doc = "",
    groupId?: symbol,
): IfBreak {
    const doc: IfBreak = { type: "if-break", breakContents, flatContents };
    if (groupId) doc.groupId = groupId;
    return doc;
}

export function indentIfBreak(contents: Doc, groupId: symbol): IndentIfBreak {
    return { type: "indent-if-break", contents, groupId };
}

export function fill(parts: Doc[]): Fill {
    return { type: "fill", parts };
}

export function lineSuffix(contents: Doc): LineSuffix {
    return { type: "line-suffix", contents };
}

export function label(name: string, contents: Doc): Label {
    return { type: "label", label: name, contents };
}

export function join(separator: Doc, docs: Doc[]): Doc[] {
    const parts: Doc[] = [];
    for (const [index, doc] of docs.entries()) {
        if (index > 0) parts.push(separator);
        parts.push(doc);
    }
    return parts;
}

/** Whether the document contains a forced break. */
export function willBreak(doc: Doc): boolean {
    return some(doc, (part) => {
        if (typeof part !== "object" || Array.isArray(part)) return false;
        return (
            (part.type === "group" && part.break) ||
            part.type === "break-parent" ||
            (part.type === "line" && part.hard === true)
        );
    });
}

/** Whether a document part satisfies the predicate, searching depth first. */
export function some(doc: Doc, predicate: (doc: Doc) => boolean): boolean {
    const stack: Doc[] = [doc];
    while (stack.length > 0) {
        const current = stack.pop() as Doc;
        if (predicate(current)) return true;
        if (Array.isArray(current)) stack.push(...current);
        else if (typeof current !== "string") {
            switch (current.type) {
                case "group":
                    stack.push(current.contents);
                    break;
                case "fill":
                    stack.push(...current.parts);
                    break;
                case "if-break":
                    stack.push(current.breakContents, current.flatContents);
                    break;
                case "align":
                case "indent":
                case "indent-if-break":
                case "label":
                case "line-suffix":
                    stack.push(current.contents);
                    break;
            }
        }
    }
    return false;
}

/** Rebuilds a document bottom up, replacing parts with the callback's result. */
export function mapDoc(doc: Doc, callback: (doc: Doc) => Doc): Doc {
    const map = (current: Doc): Doc => {
        if (Array.isArray(current)) return callback(current.map(map));
        if (typeof current === "string") return callback(current);
        switch (current.type) {
            case "group":
                return callback({
                    ...current,
                    contents: map(current.contents),
                    ...(current.expandedStates
                        ? { expandedStates: current.expandedStates.map(map) }
                        : {}),
                });
            case "fill":
                return callback({ ...current, parts: current.parts.map(map) });
            case "if-break":
                return callback({
                    ...current,
                    breakContents: map(current.breakContents),
                    flatContents: map(current.flatContents),
                });
            case "align":
            case "indent":
            case "indent-if-break":
            case "label":
            case "line-suffix":
                return callback({
                    ...current,
                    contents: map(current.contents),
                });
            default:
                return callback(current);
        }
    };
    return map(doc);
}

/** Forces flat printing: soft lines vanish, lines become spaces, hard lines stay. */
export function removeLines(doc: Doc): Doc {
    return mapDoc(doc, (part) => {
        if (typeof part !== "object" || Array.isArray(part)) return part;
        if (part.type === "line" && !part.hard) return part.soft ? "" : " ";
        if (part.type === "if-break") return part.flatContents;
        if (part.type === "group" && part.expandedStates)
            return {
                type: "group",
                contents: part.expandedStates[0] ?? "",
                break: false,
            };
        return part;
    });
}

/** The text of a document made only of strings, like Prettier's cleaned docs. */
export function text(doc: Doc): string | undefined {
    if (typeof doc === "string") return doc;
    if (!Array.isArray(doc)) return undefined;
    let result = "";
    for (const part of doc) {
        const value = text(part);
        if (value === undefined) return undefined;
        result += value;
    }
    return result;
}

/** Whether the document contains any possible line break. */
export function canBreak(doc: Doc): boolean {
    return some(
        doc,
        (part) =>
            typeof part === "object" &&
            !Array.isArray(part) &&
            part.type === "line",
    );
}

/** Whether the document prints nothing. */
export function isEmpty(doc: Doc): boolean {
    return doc === "" || (Array.isArray(doc) && doc.every(isEmpty));
}
