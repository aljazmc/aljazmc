import { type Css as C, parseCss } from "@aljazmc/syntax";
import {
    breakParent,
    type Doc,
    fill,
    group,
    hardline,
    ifBreak,
    indent,
    join,
    line,
    lineSuffix,
    literalline,
    softline,
} from "./doc.js";
import Layout from "./layout.js";

export interface CssOptions {
    lineWidth: number;
    indentWidth: number;
    useTabs: boolean;
    /** The preferred quote of strings. */
    quote: '"' | "'";
    /** Spaces inside parentheses and brackets that fit on one line. */
    delimiterSpacing: boolean;
}

/** Properties whose values keep their source lines, like `grid-template-areas`. */
const GRID = /^grid(?:-template(?:-.+)?)?$/i;

/** CSS-wide keywords, lower-cased when they are the whole value. */
const WIDE = /^(?:initial|inherit|unset|revert)$/i;

/** Math functions, whose `+`, `-`, `*` and `/` are operators. */
const MATH =
    /^(?:-[a-z]+-)?(?:calc|min|max|clamp|round|mod|rem|sin|cos|tan|asin|acos|atan|atan2|pow|sqrt|hypot|log|exp|abs|sign)$/i;

/** Suppresses formatting of the whole file, `formatero-ignore-all format`. */
const suppressFile = /^\/\*\s*(?:biome|formatero)-ignore-all\s+format\b/;

/** Suppresses formatting of the next item, `formatero-ignore format`. */
const suppressItem = /^\/\*\s*(?:biome|formatero)-ignore\s+format\b/;

/** Known at-rules, the preludes of others stay as written. */
const KNOWN = new Set([
    "charset",
    "color-profile",
    "container",
    "counter-style",
    "custom-media",
    "document",
    "-moz-document",
    "font-face",
    "font-feature-values",
    "font-palette-values",
    "function",
    "import",
    "keyframes",
    "-webkit-keyframes",
    "-moz-keyframes",
    "-o-keyframes",
    "-ms-keyframes",
    "layer",
    "media",
    "namespace",
    "page",
    "position-try",
    "property",
    "scope",
    "starting-style",
    "supports",
    "value",
    "view-transition",
]);

/** Known units, lower-cased, others keep their case. */
const UNITS = new Set(
    "em rem ex rex cap rcap ch rch ic ric lh rlh vw svw lvw dvw vh svh lvh dvh vi svi lvi dvi vb svb lvb dvb vmin svmin lvmin dvmin vmax svmax lvmax dvmax cm mm q in pc pt px mozmm rpx cqw cqh cqi cqb cqmin cqmax deg grad rad turn s ms hz khz dpi dpcm dppx x fr".split(
        " ",
    ),
);

/** A value or a comment between values. */
type Atom = C.Value | C.Comment;

interface Context {
    property?: string;
    math?: boolean;
}

/** Formats CSS. */
export default class Css {
    readonly #options: CssOptions;
    #source = "";
    #comments: C.Comment[] = [];
    readonly #printed = new Set<C.Comment>();

    constructor(options: CssOptions) {
        this.#options = options;
    }

    /** Formats a stylesheet at an indentation level, throwing a ParseError when it has errors. */
    format(source: string, level = 0): string {
        const sheet = parseCss(source);
        // a suppression of the whole file keeps it as written
        if (sheet.comments.some((comment) => suppressFile.test(comment.value)))
            return source;
        this.#source = source;
        this.#comments = sheet.comments;
        this.#printed.clear();
        let doc: Doc = this.#items(
            sheet.children,
            sheet.bom ? 1 : 0,
            source.length,
        );
        for (const comment of this.#comments)
            if (!this.#printed.has(comment))
                throw new Error(
                    `Comment would be lost: ${comment.value} at ${comment.start}`,
                );
        // indented after a line break, like code embedded in HTML
        if (level > 0) {
            doc = [hardline, doc];
            for (let index = 0; index < level; index++) doc = [indent(doc)];
        }
        const printed = new Layout({
            lineWidth: this.#options.lineWidth,
            useTabs: this.#options.useTabs,
            indentWidth: this.#options.indentWidth,
        }).print(doc);
        return (
            (sheet.bom ? "﻿" : "") +
            (level > 0 ? printed.replace(/^\n[ \t]*/, "") : printed)
        );
    }

    // Comments

    /** Unprinted comments between two positions. */
    #commentsIn(start: number, end: number): C.Comment[] {
        return this.#comments.filter(
            (comment) =>
                comment.start >= start &&
                comment.end <= end &&
                !this.#printed.has(comment),
        );
    }

    #newlines(start: number, end: number): number {
        return (this.#source.slice(start, end).match(/\r\n|\r|\n/g) ?? [])
            .length;
    }

    /** A comment, marked as printed, with the lines of block comments as written. */
    #comment(comment: C.Comment): Doc {
        this.#printed.add(comment);
        const lines = comment.value.split(/\r\n|\r|\n/);
        return lines.length === 1 ? comment.value : join(literalline, lines);
    }

    /** Values with the comments between them, from `start` to `end`. */
    #atoms(values: C.Value[], start: number, end: number): Atom[] {
        const atoms: Atom[] = [...values];
        for (const comment of this.#commentsIn(start, end))
            if (
                !values.some(
                    (value) =>
                        value.start <= comment.start &&
                        comment.end <= value.end,
                )
            )
                atoms.push(comment);
        return atoms.sort((a, b) => a.start - b.start);
    }

    /** Comments between positions, each followed by a space. */
    #inline(start: number, end: number): Doc[] {
        return this.#commentsIn(start, end).map((comment) => [
            this.#comment(comment),
            " ",
        ]);
    }

    // Lists of statements and declarations

    /** Items and the comments between them, with their blank lines. */
    #items(children: C.Item[], start: number, end: number): Doc {
        const items = children.filter((child) => child.type !== "Empty");
        const entries: (C.Item | C.Comment)[] = [...items];
        for (const comment of this.#commentsIn(start, end))
            if (
                !items.some(
                    (item) =>
                        item.start <= comment.start && comment.end <= item.end,
                )
            )
                entries.push(comment);
        entries.sort((a, b) => a.start - b.start);

        const parts: Doc[] = [];
        let previous: C.Item | C.Comment | undefined;
        for (const entry of entries) {
            if (previous) {
                // removed `;` between items take their lines
                const after = Math.max(
                    previous.end,
                    ...children
                        .filter(
                            (child) =>
                                child.type === "Empty" &&
                                child.end <= entry.start,
                        )
                        .map((child) => child.end),
                );
                const lines = this.#newlines(after, entry.start);
                if (
                    lines === 0 &&
                    (entry.type === "Comment" || previous.type === "Comment")
                ) {
                    if (
                        entry.type === "Comment" &&
                        previous.type !== "Comment"
                    ) {
                        parts.push(
                            lineSuffix([" ", this.#comment(entry)]),
                            breakParent,
                        );
                        previous = entry;
                        continue;
                    }
                    parts.push(" ");
                } else {
                    parts.push(hardline);
                    if (lines > 1) parts.push(hardline);
                }
            }
            if (entry.type === "Comment") parts.push(this.#comment(entry));
            else if (
                previous?.type === "Comment" &&
                suppressItem.test(previous.value)
            ) {
                for (const comment of this.#commentsIn(entry.start, entry.end))
                    this.#printed.add(comment);
                parts.push(
                    Css.#verbatim(this.#source.slice(entry.start, entry.end)),
                );
            } else parts.push(this.#item(entry));
            previous = entry;
        }
        return parts;
    }

    #item(node: C.Item): Doc {
        switch (node.type) {
            case "Rule":
                return this.#rule(node);
            case "AtRule":
                return this.#atRule(node);
            case "Declaration":
                return this.#declaration(node);
            case "Empty":
                return "";
        }
    }

    #block(block: C.Block): Doc {
        const children = block.children.filter(
            (child) => child.type !== "Empty",
        );
        if (
            children.length === 0 &&
            this.#commentsIn(block.start, block.end).length === 0
        )
            return ["{", hardline, "}"];
        return [
            "{",
            indent([
                hardline,
                this.#items(block.children, block.start + 1, block.end - 1),
            ]),
            hardline,
            "}",
        ];
    }

    // Rules and selectors

    #rule(node: C.Rule): Doc {
        const end =
            node.selectors?.end ?? node.prelude.at(-1)?.end ?? node.start;
        const prelude = node.selectors
            ? this.#selectorList(node.selectors, true)
            : this.#keyframeSelectors(node.prelude);
        const between = this.#commentsIn(end, node.block.start).map(
            (comment) => [" ", this.#comment(comment)],
        );
        return [prelude, between, " ", this.#block(node.block)];
    }

    #keyframeSelectors(prelude: C.Value[]): Doc {
        return join(
            [",", line],
            Css.#split(prelude).map((values) =>
                join(
                    " ",
                    values.map((value) =>
                        value.type === "Identifier" &&
                        /^(?:from|to)$/i.test(value.value)
                            ? value.value.toLowerCase()
                            : this.#value(value, {}),
                    ),
                ),
            ),
        );
    }

    /** Selectors separated by commas, the line breaks of rules always break. */
    #selectorList(list: C.SelectorList, top: boolean): Doc {
        const parts: Doc[] = [];
        for (const [index, selector] of list.children.entries()) {
            if (index > 0) {
                const previous = list.children[index - 1] as C.Selector;
                parts.push(",");
                const comments = this.#commentsIn(previous.end, selector.start);
                parts.push(line);
                for (const comment of comments) {
                    parts.push(this.#comment(comment));
                    parts.push(
                        this.#newlines(comment.end, selector.start) > 0
                            ? hardline
                            : " ",
                    );
                }
            }
            const commented =
                this.#commentsIn(selector.start, selector.end).length > 0;
            const doc = this.#selector(selector);
            parts.push(
                selector.children.length > 1 && !commented
                    ? group(indent(doc))
                    : group(doc),
            );
        }
        return top ? parts : parts;
    }

    #selector(selector: C.Selector): Doc {
        const parts: Doc[] = [];
        for (const [index, compound] of selector.children.entries()) {
            const combinator = compound.combinator;
            if (index === 0) {
                if (combinator) parts.push(combinator.value, " ");
            } else {
                const previous = selector.children[
                    index - 1
                ] as C.CompoundSelector;
                const comments = this.#commentsIn(
                    previous.end,
                    compound.element?.start ??
                        compound.children[0]?.start ??
                        compound.end,
                );
                if (comments.length > 0) {
                    let at = previous.end;
                    for (const comment of comments) {
                        const before = this.#newlines(at, comment.start);
                        if (before > 0) {
                            parts.push(hardline);
                            if (before > 1) parts.push(hardline);
                        } else parts.push(" ");
                        parts.push(this.#comment(comment));
                        at = comment.end;
                    }
                    const lines = this.#newlines(
                        at,
                        compound.element?.start ??
                            compound.children[0]?.start ??
                            compound.end,
                    );
                    if (lines > 0) {
                        parts.push(hardline);
                        if (lines > 1) parts.push(hardline);
                    } else parts.push(" ");
                    if (combinator && combinator.value !== " ")
                        parts.push(combinator.value, " ");
                } else if (!combinator || combinator.value === " ")
                    parts.push(line);
                else parts.push(line, combinator.value, " ");
            }
            parts.push(this.#compound(compound));
        }
        return parts;
    }

    #compound(compound: C.CompoundSelector): Doc {
        const parts: Doc[] = [];
        const element = compound.element;
        if (element) {
            if (element.namespace !== null) parts.push(element.namespace, "|");
            parts.push(
                element.type === "UniversalSelector" ? "*" : element.name,
            );
        }
        const nesting = compound.children.filter(
            (child) =>
                child.type === "NestingSelector" &&
                (!element || child.end <= element.start),
        );
        const rest = compound.children
            .filter((child) => !nesting.includes(child))
            .map((child) => this.#subSelector(child));
        const comments = this.#commentsIn(compound.start, compound.end).map(
            (comment) => this.#comment(comment),
        );
        return [...nesting.map(() => "&"), ...parts, ...rest, ...comments];
    }

    #subSelector(node: C.SubSelector): Doc {
        switch (node.type) {
            case "NestingSelector":
                return "&";
            case "IdSelector":
                return `#${node.name}`;
            case "ClassSelector":
                return `.${node.name}`;
            case "AttributeSelector": {
                const space = this.#options.delimiterSpacing ? " " : "";
                const name =
                    node.namespace !== null
                        ? `${node.namespace}|${node.name}`
                        : node.name;
                if (!node.matcher || !node.value)
                    return ["[", space, name, space, "]"];
                const value =
                    node.value.type === "String"
                        ? this.#stringDoc(node.value.raw)
                        : this.#string(`"${node.value.value}"`);
                const modifier = node.modifier ? ` ${node.modifier}` : "";
                return [
                    "[",
                    space,
                    name,
                    node.matcher,
                    value,
                    modifier,
                    space,
                    "]",
                ];
            }
            case "PseudoClassSelector":
            case "PseudoElementSelector": {
                const colons = node.type === "PseudoClassSelector" ? ":" : "::";
                const name = node.name.startsWith("--")
                    ? node.name
                    : node.name.toLowerCase();
                if (!node.argument) return [colons, name];
                return [colons, name, this.#pseudoArgument(node.argument)];
            }
        }
    }

    /** Parentheses with their contents indented when they break. */
    #parenthesized(contents: Doc, open = "(", close = ")"): Doc {
        const space = this.#options.delimiterSpacing;
        return group([
            open,
            indent([space ? line : softline, contents]),
            space ? line : softline,
            close,
        ]);
    }

    #pseudoArgument(argument: C.PseudoArgument): Doc {
        switch (argument.type) {
            case "SelectorList":
                if (argument.children.length === 0) return "()";
                return this.#parenthesized(this.#selectorList(argument, false));
            case "Nth": {
                let doc: Doc = group(this.#nth(argument.value));
                if (argument.selectors)
                    doc = [
                        doc,
                        " of ",
                        this.#selectorList(argument.selectors, false),
                    ];
                return this.#parenthesized(doc);
            }
            case "PseudoValues": {
                const atoms = this.#atoms(
                    argument.children,
                    argument.start,
                    argument.end,
                );
                const parts: Doc[] = [];
                for (const [index, atom] of atoms.entries()) {
                    const previous = atoms[index - 1];
                    if (atom.type === "Comma") {
                        parts.push(",");
                        continue;
                    }
                    if (previous) {
                        if (
                            previous.type === "Comment" &&
                            this.#newlines(previous.end, atom.start) > 0
                        )
                            parts.push(hardline);
                        else parts.push(previous.type === "Comma" ? line : " ");
                    }
                    parts.push(this.#atom(atom, {}));
                }
                return this.#parenthesized(parts);
            }
        }
    }

    /** An+B with spaces around the offset sign, like `2n + 1`. */
    #nth(value: string): Doc {
        const compact = value
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/\s+/g, "");
        if (/^(?:even|odd)$/i.test(compact)) return compact.toLowerCase();
        const match = /^([+-]?)(\d*)n([+-])(\d+)$/i.exec(compact);
        if (match) {
            const [, sign, a, offset, b] = match as unknown as [
                string,
                string,
                string,
                string,
                string,
            ];
            return [
                sign,
                a ? Css.#number(a) : "",
                "n",
                line,
                offset,
                " ",
                Css.#number(b),
            ];
        }
        const simple = /^([+-]?)(\d*)n$/i.exec(compact);
        if (simple)
            return `${simple[1]}${simple[2] ? Css.#number(simple[2]) : ""}n`;
        return compact;
    }

    // Declarations

    #declaration(node: C.Declaration): Doc {
        const custom = node.property.startsWith("--");
        const name =
            custom || !/[A-Z]/.test(node.property)
                ? node.property
                : node.property.toLowerCase();

        // comments between the name and the colon stay after the name
        const parts: Doc[] = [name];
        const nameComments = this.#commentsIn(node.propertyEnd, node.colon);
        let breakBeforeColon = false;
        for (const [index, comment] of nameComments.entries()) {
            if (index > 0) parts.push(" ");
            parts.push(this.#comment(comment));
            if (
                this.#newlines(
                    comment.end,
                    nameComments[index + 1]?.start ?? node.colon,
                ) > 0
            )
                breakBeforeColon = true;
        }
        if (breakBeforeColon) parts.push(literalline, ":");
        else {
            const last = nameComments.at(-1);
            parts.push(
                last &&
                    !custom &&
                    last.end < node.colon &&
                    /\s/.test(this.#source.slice(last.end, node.colon))
                    ? " :"
                    : ":",
            );
        }

        const first = node.value[0];
        const valueEnd =
            node.important?.start ?? node.value.at(-1)?.end ?? node.colon + 1;
        const leading = this.#commentsIn(
            node.colon + 1,
            first?.start ?? valueEnd,
        );
        const gapAfterColon = /^\s/.test(this.#source.slice(node.colon + 1));
        if (leading.length > 0) {
            for (const [index, comment] of leading.entries()) {
                if (index === 0) {
                    if (this.#newlines(node.colon + 1, comment.start) > 0)
                        parts.push(literalline);
                    else if (gapAfterColon || first === undefined)
                        parts.push(" ");
                } else parts.push(" ");
                parts.push(this.#comment(comment));
            }
            if (first) parts.push(" ", this.#propertyValue(node, custom, true));
        } else if (first)
            parts.push(" ", this.#propertyValue(node, custom, false));
        else if (!node.important) parts.push(" ");

        if (node.important) {
            parts.push(
                ...this.#commentsIn(valueEnd - 1, node.important.start).map(
                    (comment) => [" ", this.#comment(comment)],
                ),
            );
            parts.push(" !", node.important.keyword.toLowerCase());
            const after = this.#commentsIn(node.important.end, node.end);
            for (const comment of after)
                parts.push(" ", this.#comment(comment));
            if (
                after.length > 0 &&
                /\s;?$/.test(
                    this.#source.slice(after.at(-1)?.end ?? node.end, node.end),
                )
            )
                parts.push(" ");
        } else {
            for (const comment of this.#commentsIn(valueEnd, node.end))
                parts.push(" ", this.#comment(comment));
        }
        parts.push(";");
        return parts;
    }

    #propertyValue(
        node: C.Declaration,
        custom: boolean,
        afterComment: boolean,
    ): Doc {
        const values = node.value;
        const end = node.important?.start ?? node.end;
        // IE filters like `progid:DXImage…` stay as written
        if (
            values[0]?.type === "Identifier" &&
            /^progid$/i.test(values[0].value) &&
            values[1]?.type === "Colon"
        ) {
            const last = values.at(-1) as C.Value;
            for (const comment of this.#commentsIn(values[0].start, last.end))
                this.#printed.add(comment);
            return this.#source.slice(values[0].start, last.end);
        }
        const atoms = this.#atoms(values, values[0]?.start ?? end, end);
        const context: Context = { property: node.property };
        if (GRID.test(node.property))
            return this.#preserveLines(atoms, context);
        if (atoms.length === 1) {
            const value = atoms[0] as Atom;
            if (
                value.type === "Identifier" &&
                WIDE.test(value.value) &&
                !custom
            )
                return value.value.toLowerCase();
            return this.#atom(value, context);
        }
        const groups = Css.#groups(atoms);
        const commas = groups.length > 1;
        if (
            !custom &&
            commas &&
            Math.max(
                ...groups.map(
                    (group) =>
                        group.filter(
                            (atom) =>
                                atom.type !== "Comment" &&
                                atom.type !== "Comma",
                        ).length,
                ),
            ) >= 2
        ) {
            const lines = join(
                hardline,
                groups.map((group) => this.#fill(group, context)),
            );
            return indent([hardline, lines]);
        }
        if (commas) {
            let size = 0;
            let count = 0;
            for (const value of values)
                if (value.end - value.start > 1) {
                    size += value.end - value.start;
                    count++;
                }
            if (size >= this.#options.lineWidth && count > 12) {
                // one per line keeps the lines of the source
                const parts: Doc[] = [];
                for (const [index, group] of groups.entries()) {
                    if (index > 0) {
                        const previous = groups[index - 1]?.at(-1) as Atom;
                        parts.push(
                            this.#newlines(
                                previous.end,
                                (group[0] as Atom).start,
                            ) > 0
                                ? hardline
                                : " ",
                        );
                    }
                    parts.push(this.#fill(group, context));
                }
                return indent([hardline, parts]);
            }
            const delimited = true;
            return indent(
                group([
                    delimited && !afterComment ? softline : "",
                    fill(
                        join(
                            line,
                            groups.map((group) =>
                                group_(this.#fill(group, context)),
                            ),
                        ),
                    ),
                ]),
            );
        }
        const delimited = values.some(
            (value) =>
                value.type === "Delimiter" &&
                (value.value === "/" || value.value === "%"),
        );
        return indent(
            group([
                delimited && !afterComment ? softline : "",
                this.#fill(atoms, context),
            ]),
        );
    }

    /** Values that keep their source lines, for grid templates. */
    #preserveLines(atoms: Atom[], context: Context): Doc {
        const parts: Doc[] = [];
        let broke = false;
        for (const [index, atom] of atoms.entries()) {
            const previous = atoms[index - 1];
            if (previous && atom.type !== "Comma") {
                if (this.#newlines(previous.end, atom.start) > 0) {
                    parts.push(hardline);
                    broke = true;
                } else parts.push(" ");
            }
            parts.push(this.#atom(atom, context));
        }
        return group(indent([broke ? hardline : "", parts]));
    }

    /** Splits atoms after their commas, the commas stay in their groups. */
    static #groups(atoms: Atom[]): Atom[][] {
        const groups: Atom[][] = [[]];
        for (const atom of atoms) {
            (groups.at(-1) as Atom[]).push(atom);
            if (atom.type === "Comma") groups.push([]);
        }
        if (groups.at(-1)?.length === 0) groups.pop();
        return groups;
    }

    /** Splits values at their commas, without them. */
    static #split<T extends Atom>(values: T[]): T[][] {
        const groups: T[][] = [[]];
        for (const value of values)
            if (value.type === "Comma") groups.push([]);
            else (groups.at(-1) as T[]).push(value);
        return groups;
    }

    /** Joins syntax types written together, like `<length>#`, into one delimiter. */
    #types(atoms: Atom[]): Atom[] {
        const result: Atom[] = [];
        for (let index = 0; index < atoms.length; index++) {
            const open = atoms[index] as Atom;
            const name = atoms[index + 1];
            const close = atoms[index + 2];
            if (
                open.type === "Delimiter" &&
                open.value === "<" &&
                name?.type === "Identifier" &&
                close?.type === "Delimiter" &&
                close.value === ">" &&
                name.start === open.end &&
                close.start === name.end
            ) {
                let end = close.end;
                let text = `<${name.value}>`;
                index += 2;
                for (;;) {
                    const next = atoms[index + 1];
                    if (
                        next?.type === "Delimiter" &&
                        /^[#+?*]$/.test(next.value) &&
                        next.start === end
                    ) {
                        text += next.value;
                        end = next.end;
                        index++;
                    } else break;
                }
                result.push({
                    type: "Delimiter",
                    start: open.start,
                    end,
                    value: text,
                });
            } else result.push(open);
        }
        return result;
    }

    /** Atoms filling lines, separated by spaces, commas end the value before them. */
    #fill(input: Atom[], context: Context): Doc {
        const atoms = this.#types(input);
        if (context.math) return this.#operations(atoms, context);
        const parts: Doc[] = [];
        for (const atom of atoms) {
            const doc = this.#atom(atom, context);
            if (atom.type === "Comma" && parts.length > 0) {
                parts[parts.length - 1] = [parts[parts.length - 1] as Doc, doc];
                continue;
            }
            if (parts.length > 0) parts.push(line);
            parts.push(doc);
        }
        return fill(parts);
    }

    /** Operands of math functions, breaking after their operators. */
    #operations(atoms: Atom[], context: Context): Doc {
        const parts: Doc[] = [];
        for (const [index, atom] of atoms.entries()) {
            if (index > 0 && atom.type !== "Comma") {
                if (Css.#unaryBefore(atoms, index)) parts.push("");
                else if (Css.#isOperator(atoms[index - 1])) parts.push(line);
                else parts.push(" ");
            }
            parts.push(this.#atom(atom, context));
        }
        return parts;
    }

    /** Whether the atom before is a sign of this one. */
    static #unaryBefore(atoms: Atom[], index: number): boolean {
        const previous = atoms[index - 1];
        if (!Css.#isOperator(previous)) return false;
        const value = (previous as C.Delimiter).value;
        if (value === "*" || value === "/") return false;
        return (
            previous?.end === atoms[index]?.start &&
            (index === 1 || Css.#isOperator(atoms[index - 2]))
        );
    }

    static #isOperator(atom: Atom | undefined): boolean {
        return atom?.type === "Delimiter" && /^[-+*/]$/.test(atom.value);
    }

    #atom(atom: Atom, context: Context): Doc {
        return atom.type === "Comment"
            ? this.#comment(atom)
            : this.#value(atom, context);
    }

    // Values

    #value(value: C.Value, context: Context): Doc {
        switch (value.type) {
            case "Identifier":
                return value.value;
            case "Number":
                return Css.#number(value.value);
            case "Percentage":
                return `${Css.#number(value.value)}%`;
            case "Dimension":
                return Css.#number(value.value) + Css.#unit(value.unit);
            case "String":
                return this.#stringDoc(value.raw);
            case "Hash":
                return /^(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(
                    value.value,
                )
                    ? `#${value.value.toLowerCase()}`
                    : `#${value.value}`;
            case "Url":
                return this.#url(value, context);
            case "Function":
                return this.#function(value, context);
            case "SimpleBlock": {
                const close =
                    value.open === "(" ? ")" : value.open === "[" ? "]" : "}";
                const atoms = this.#atoms(
                    value.children,
                    value.start + 1,
                    value.end - 1,
                );
                if (value.open === "[") {
                    const space =
                        this.#options.delimiterSpacing && atoms.length > 0
                            ? " "
                            : "";
                    return ["[", space, this.#fill(atoms, context), space, "]"];
                }
                return this.#parenthesized(
                    this.#arguments(atoms, context),
                    value.open,
                    close,
                );
            }
            case "Comma":
                return ",";
            case "Colon":
                return ":";
            case "Semicolon":
                return ";";
            case "Delimiter":
                return value.value;
            case "UnicodeRange":
                return value.value;
            case "AtKeyword":
                return `@${value.value}`;
        }
    }

    #url(value: C.Url, context: Context): Doc {
        const space = this.#options.delimiterSpacing;
        const address = value.value
            ? value.value.type === "String"
                ? this.#string(value.value.raw)
                : Css.#trimUrl(value.value.value)
            : "";
        const inner = this.#atoms(
            value.modifiers,
            value.start,
            value.end,
        ).filter(
            (atom) =>
                atom.type !== "Comment" ||
                atom.start > (value.value?.end ?? value.start),
        );
        const leading = this.#commentsIn(
            value.start,
            value.value?.start ?? value.end,
        ).map((comment) => [this.#comment(comment), " "]);
        const modifiers =
            inner.length > 0
                ? [
                      " ",
                      join(
                          " ",
                          inner.map((atom) => this.#atom(atom, context)),
                      ),
                  ]
                : "";
        const pad = space && address ? " " : "";
        return [value.name, "(", pad, leading, address, modifiers, pad, ")"];
    }

    /** An unquoted address without the whitespace after it, an escaped one stays. */
    static #trimUrl(value: string): string {
        const trimmed = value.replace(/[ \t\n\r\f]+$/, "");
        const backslashes = /\\*$/.exec(trimmed)?.[0].length ?? 0;
        return backslashes % 2 === 1
            ? value.slice(0, trimmed.length + 1)
            : trimmed;
    }

    #function(node: C.FunctionValue, context: Context): Doc {
        const name = node.name;
        const lower = name.toLowerCase();
        const atoms = this.#atoms(
            node.children,
            node.start + name.length,
            node.end - 1,
        );
        if (atoms.length === 0) return [name, "()"];
        if (lower === "if")
            return [name, this.#parenthesized(this.#ifBranches(node))];
        if (lower === "selector")
            return [
                name,
                this.#parenthesized(
                    this.#source.slice(node.open + 1, node.end - 1).trim(),
                ),
            ];
        const inner: Context = {
            ...context,
            math: MATH.test(name) || context.math === true,
        };
        // `var(--a,)` keeps its trailing comma
        const trailing =
            /^(?:var|attr)$/i.test(name) && atoms.at(-1)?.type === "Comma"
                ? ","
                : "";
        return [
            name,
            this.#parenthesized([this.#arguments(atoms, inner), trailing]),
        ];
    }

    /** Arguments separated by commas, each filling its line. */
    #arguments(atoms: Atom[], context: Context): Doc {
        const groups = Css.#split(atoms);
        if (groups.length > 1 && groups.at(-1)?.length === 0) groups.pop();
        return join(
            [",", line],
            groups.map((group) =>
                group.length === 1
                    ? this.#atom(group[0] as Atom, context)
                    : context.math
                      ? group_(this.#operations(group, context))
                      : indent(group_(this.#fill(group, context))),
            ),
        );
    }

    /** The branches of `if()`, separated by semicolons. */
    #ifBranches(node: C.FunctionValue): Doc {
        const branches: Atom[][] = [[]];
        for (const atom of this.#atoms(
            node.children,
            node.open + 1,
            node.end - 1,
        ))
            if (atom.type === "Semicolon") branches.push([]);
            else (branches.at(-1) as Atom[]).push(atom);
        const trailing = branches.length > 1 && branches.at(-1)?.length === 0;
        if (trailing) branches.pop();
        const docs = branches.map((branch) => {
            const colon = branch.findIndex((value) => value.type === "Colon");
            if (colon < 0)
                return join(
                    " ",
                    branch.map((atom) => this.#atom(atom, {})),
                );
            const test = branch.slice(0, colon);
            const value = branch.slice(colon + 1);
            const testDoc = join(
                " ",
                test.map((part) =>
                    part.type === "Comment"
                        ? this.#comment(part)
                        : this.#conditionPart(part, "supports"),
                ),
            );
            return [
                testDoc,
                ":",
                value.length > 0 ? [" ", this.#fill(value, {})] : " ",
            ];
        });
        return [join([";", line], docs), trailing ? ifBreak(";") : ""];
    }

    /** Normalizes a number: lower case, no redundant zeros or plus sign in exponents. */
    static #number(raw: string): string {
        return raw
            .toLowerCase()
            .replace(/^([+-]?[\d.]+e)(?:\+|(-))?0*(\d)/, "$1$2$3")
            .replace(/^([+-]?[\d.]+)e[+-]?0+$/, "$1")
            .replace(/^([+-])?\./, "$10.")
            .replace(/(\.\d*?)0+(?=e|$)/, "$1")
            .replace(/\.(?=e|$)/, "");
    }

    static #unit(unit: string): string {
        const lower = unit.toLowerCase();
        if (!UNITS.has(lower)) return unit;
        if (lower === "hz") return "Hz";
        if (lower === "khz") return "kHz";
        if (lower === "q") return "Q";
        return lower;
    }

    /** A string, its escaped newlines stay as written. */
    #stringDoc(raw: string): Doc {
        const text = this.#string(raw);
        const lines = text.split(/\r\n|\r|\n/);
        if (lines.length === 1) return text;
        return lines.flatMap((part, index) =>
            index === 0
                ? [part]
                : [{ type: "line", hard: true, literal: true } as const, part],
        );
    }

    /** Requotes a string with the preferred quote, unless that needs more escapes. */
    #string(raw: string): string {
        const quote = this.#options.quote;
        const content = raw.slice(1, -1);
        const alternate = quote === '"' ? "'" : '"';
        const count = (char: string) => content.split(char).length - 1;
        const enclosing = count(quote) > count(alternate) ? alternate : quote;
        if (raw.startsWith(enclosing)) return raw;
        const other = enclosing === '"' ? "'" : '"';
        const body = content.replace(
            /\\([\s\S])|(["'])/g,
            (match, escaped: string | undefined, bare: string | undefined) => {
                if (escaped === other) return escaped;
                if (bare === enclosing) return `\\${bare}`;
                if (bare) return bare;
                return match;
            },
        );
        return enclosing + body + enclosing;
    }

    // At-rules

    #atRule(node: C.AtRule): Doc {
        const keyword = node.keyword;
        const known = KNOWN.has(keyword);
        const dashed = node.name.startsWith("--");
        const unknownColon = !known && node.prelude[0]?.type === "Colon";
        const name = dashed || unknownColon ? node.name : keyword;
        const parts: Doc[] = ["@", name];
        const end = node.block?.start ?? node.end;
        const nameEnd = node.start + 1 + node.name.length;
        for (const comment of this.#commentsIn(nameEnd, node.preludeStart))
            parts.push(" ", this.#comment(comment));
        if (!known) {
            if (node.prelude.length > 0) {
                const text = this.#source.slice(
                    node.preludeStart,
                    node.preludeEnd,
                );
                for (const comment of this.#commentsIn(
                    node.preludeStart,
                    node.preludeEnd,
                ))
                    this.#printed.add(comment);
                parts.push(" ", Css.#verbatim(text));
            } else if (node.block) parts.push(" ");
        } else {
            const prelude = this.#prelude(node);
            if (prelude !== "") parts.push(" ", prelude);
        }
        for (const comment of this.#commentsIn(node.preludeEnd, end))
            parts.push(" ", this.#comment(comment));
        if (node.block) {
            if (known || node.prelude.length > 0) parts.push(" ");
            parts.push(this.#block(node.block));
        } else parts.push(";");
        return parts;
    }

    /** Source text printed as written, its lines too. */
    static #verbatim(text: string): Doc {
        const lines = text.split(/\r\n|\r|\n/);
        return lines.length === 1 ? text : join(literalline, lines);
    }

    #prelude(node: C.AtRule): Doc {
        const values = node.prelude;
        const atoms = this.#atoms(values, node.preludeStart, node.preludeEnd);
        if (atoms.length === 0) return "";
        switch (node.keyword) {
            case "charset":
                return atoms.map((atom) =>
                    atom.type === "String" ? atom.raw : this.#atom(atom, {}),
                );
            case "media":
                return group(indent(this.#queries(atoms, "media")));
            case "custom-media": {
                const [name, ...rest] = atoms;
                const query =
                    rest.length === 1 &&
                    rest[0]?.type === "Identifier" &&
                    /^(?:true|false)$/i.test(rest[0].value)
                        ? rest[0].value.toLowerCase()
                        : this.#queries(rest, "media");
                return group(
                    indent([this.#atom(name as Atom, {}), " ", query]),
                );
            }
            case "supports":
                return group(indent(this.#condition(atoms, "supports")));
            case "container":
                return group(indent(this.#condition(atoms, "container")));
            case "import":
                return this.#import(atoms);
            case "scope":
                return this.#scope(atoms);
            case "document":
            case "-moz-document":
                return join(
                    ", ",
                    Css.#split(atoms).map((group) =>
                        join(
                            " ",
                            group.map((atom) => this.#atom(atom, {})),
                        ),
                    ),
                );
            case "layer":
                return group(
                    indent(
                        join(
                            [",", line],
                            Css.#split(atoms).map((group) =>
                                this.#tight(group),
                            ),
                        ),
                    ),
                );
            case "page":
                return this.#tight(atoms, true);
            case "function":
                return this.#functionPrelude(atoms);
            default:
                return group(indent(this.#generic(atoms)));
        }
    }

    /** Values joined as written, without spaces where the source has none, like `a.b` or `name:first`. */
    #tight(atoms: Atom[], preserveCase = false): Doc {
        const parts: Doc[] = [];
        for (const [index, atom] of atoms.entries()) {
            const previous = atoms[index - 1];
            if (previous && previous.end < atom.start) parts.push(" ");
            parts.push(
                atom.type === "Identifier" && preserveCase
                    ? atom.value
                    : this.#atom(atom, {}),
            );
        }
        return parts;
    }

    /** Values of a prelude separated by spaces, commas by lines. */
    #generic(atoms: Atom[]): Doc {
        const parts: Doc[] = [];
        for (const [index, atom] of atoms.entries()) {
            const previous = atoms[index - 1];
            if (atom.type === "Comma") {
                parts.push(",");
                continue;
            }
            if (previous) parts.push(previous.type === "Comma" ? line : " ");
            parts.push(this.#atom(atom, {}));
        }
        return parts;
    }

    /** Media queries separated by commas, filling lines. */
    #queries(atoms: Atom[], mode: Mode): Doc {
        const groups = Css.#groups(atoms);
        return fill(
            join(
                line,
                groups.map((group) => {
                    const comma = group.at(-1)?.type === "Comma";
                    const query = comma ? group.slice(0, -1) : group;
                    return [this.#condition(query, mode), comma ? "," : ""];
                }),
            ),
        );
    }

    /** A condition, breaking after `and` and `or`. */
    #condition(atoms: Atom[], mode: Mode): Doc {
        if (
            atoms.some(
                (atom) =>
                    atom.type === "Delimiter" && /^[<>=]$/.test(atom.value),
            )
        )
            return this.#range(atoms, mode);
        const parts: Doc[] = [];
        for (const [index, atom] of atoms.entries()) {
            const previous = atoms[index - 1];
            if (previous) {
                const keyword =
                    previous.type === "Identifier" &&
                    /^(?:and|or)$/i.test(previous.value);
                parts.push(keyword ? line : " ");
            }
            parts.push(
                atom.type === "Comment"
                    ? this.#comment(atom)
                    : this.#conditionPart(atom, mode),
            );
        }
        return parts;
    }

    /** A part of a condition: features in parentheses are spaced like declarations. */
    #conditionPart(value: C.Value, mode: Mode): Doc {
        if (value.type === "SimpleBlock" && value.open === "(")
            return this.#feature(value, mode);
        if (value.type === "Function") {
            const lower = value.name.toLowerCase();
            const atoms = this.#atoms(
                value.children,
                value.open + 1,
                value.end - 1,
            );
            if (lower === "selector")
                return [
                    value.name,
                    "(",
                    group(this.#selectorSource(value.open + 1, value.end - 1)),
                    ")",
                ];
            if (/^(?:style|scroll-state|supports|media)$/.test(lower)) {
                const inner = Css.#hasColon(atoms)
                    ? this.#declarationLike(
                          atoms,
                          lower === "media" ? "media" : "supports",
                          lower === "scroll-state",
                      )
                    : this.#condition(
                          atoms,
                          lower === "media" ? "media" : "supports",
                      );
                return [value.name, this.#parenthesized(inner)];
            }
        }
        return this.#value(value, {});
    }

    /** Selectors written in a range, like the argument of `selector()`. */
    #selectorSource(start: number, end: number): Doc {
        const text = this.#source.slice(start, end).trim();
        try {
            const list = parseCss(`${text}{}`).children[0];
            if (list?.type === "Rule" && list.selectors) {
                const saved = this.#source;
                this.#source = `${text}{}`;
                const saveComments = this.#comments;
                this.#comments = [];
                const doc = this.#selectorList(list.selectors, false);
                this.#source = saved;
                this.#comments = saveComments;
                return doc;
            }
        } catch {
            // keep it as written
        }
        return text;
    }

    static #hasColon(atoms: Atom[]): boolean {
        return atoms.some((atom) => atom.type === "Colon");
    }

    /** A media or container feature, like `(min-width: 100px)`, or a condition in parentheses. */
    #feature(block: C.SimpleBlock, mode: Mode): Doc {
        const atoms = this.#atoms(
            block.children,
            block.start + 1,
            block.end - 1,
        );
        const space = this.#options.delimiterSpacing ? " " : "";
        let inner: Doc;
        const first = atoms.find((atom) => atom.type !== "Comment");
        if (Css.#hasColon(atoms) && !(first?.type === "SimpleBlock"))
            inner = this.#declarationLike(atoms, mode, false);
        else if (
            first?.type === "SimpleBlock" ||
            (first?.type === "Identifier" && /^not$/i.test(first.value)) ||
            first?.type === "Function"
        )
            return group([
                "(",
                indent([
                    space ? line : softline,
                    group(this.#condition(atoms, mode)),
                ]),
                space ? line : softline,
                ")",
            ]);
        else inner = this.#range(atoms, mode);
        if (mode === "media")
            return group([
                "(",
                indent([space ? line : softline, inner]),
                space ? line : softline,
                ")",
            ]);
        return ["(", space, inner, space, ")"];
    }

    /** `name: value` in parentheses, names of media features are lower-cased. */
    #declarationLike(atoms: Atom[], mode: Mode, preserve: boolean): Doc {
        const colon = atoms.findIndex((atom) => atom.type === "Colon");
        const names = atoms.slice(0, colon);
        const values = atoms.slice(colon + 1);
        const nameDocs = names.map((atom) =>
            atom.type === "Identifier"
                ? mode === "media" && !atom.value.startsWith("--") && !preserve
                    ? atom.value.toLowerCase()
                    : atom.value
                : this.#atom(atom, {}),
        );
        // `!important` in supports tests
        const valueDocs: Doc[] = [];
        for (let index = 0; index < values.length; index++) {
            const atom = values[index] as Atom;
            const next = values[index + 1];
            if (
                atom.type === "Delimiter" &&
                atom.value === "!" &&
                next?.type === "Identifier"
            ) {
                valueDocs.push(`!${next.value.toLowerCase()}`);
                index++;
            } else valueDocs.push(this.#atom(atom, {}));
        }
        return [join(" ", nameDocs), ": ", join(" ", valueDocs)];
    }

    /** Values of a range feature, with comparisons spaced, like `400px <= width`. */
    #range(atoms: Atom[], mode: Mode): Doc {
        const parts: Doc[] = [];
        for (let index = 0; index < atoms.length; index++) {
            const atom = atoms[index] as Atom;
            let doc: Doc;
            if (atom.type === "Delimiter" && /^[<>=]$/.test(atom.value)) {
                const next = atoms[index + 1];
                if (
                    next?.type === "Delimiter" &&
                    next.value === "=" &&
                    next.start === atom.end
                ) {
                    doc = `${atom.value}=`;
                    index++;
                } else doc = atom.value;
            } else if (
                atom.type === "Identifier" &&
                mode !== "supports" &&
                !atom.value.startsWith("--")
            )
                doc = atom.value.toLowerCase();
            else
                doc =
                    atom.type === "Comment"
                        ? this.#comment(atom)
                        : this.#conditionPart(atom, mode);
            if (parts.length > 0) parts.push(" ");
            parts.push(doc);
        }
        return parts;
    }

    /** `@import` with its url, layer, supports condition and media queries, filling lines. */
    #import(atoms: Atom[]): Doc {
        const items: Doc[] = [];
        let pending: Doc[] = [];
        const push = (doc: Doc) => {
            items.push([...pending, doc]);
            pending = [];
        };
        let index = 0;
        for (; index < atoms.length; index++) {
            const atom = atoms[index] as Atom;
            if (atom.type === "Comment") pending.push(this.#comment(atom), " ");
            else if (index === 0 || items.length === 0)
                push(this.#atom(atom, {}));
            else if (atom.type === "Identifier" && /^layer$/i.test(atom.value))
                push(atom.value.toLowerCase());
            else if (atom.type === "Function" && /^layer$/i.test(atom.name))
                push([
                    atom.name,
                    "(",
                    this.#tight(
                        this.#atoms(atom.children, atom.open + 1, atom.end - 1),
                    ),
                    ")",
                ]);
            else if (
                atom.type === "Function" &&
                /^supports$/i.test(atom.name)
            ) {
                const inner = this.#atoms(
                    atom.children,
                    atom.open + 1,
                    atom.end - 1,
                );
                const condition =
                    Css.#hasColon(inner) &&
                    inner.find((part) => part.type !== "Comment")?.type !==
                        "SimpleBlock"
                        ? this.#declarationLike(inner, "supports", true)
                        : this.#condition(inner, "supports");
                push([atom.name, "(", group(condition), ")"]);
            } else break;
        }
        for (const query of Css.#groups(atoms.slice(index))) {
            const comma = query.at(-1)?.type === "Comma";
            const values = comma ? query.slice(0, -1) : query;
            const leading: Doc[] = [];
            let start = 0;
            while (values[start]?.type === "Comment") {
                leading.push(this.#comment(values[start] as C.Comment), " ");
                start++;
            }
            push([
                ...leading,
                this.#condition(values.slice(start), "media"),
                comma ? "," : "",
            ]);
        }
        return indent(fill(join(line, items)));
    }

    /** `@scope (selectors) to (selectors)`. */
    #scope(atoms: Atom[]): Doc {
        return join(
            " ",
            atoms.map((atom) =>
                atom.type === "SimpleBlock" && atom.open === "("
                    ? [
                          "(",
                          group(
                              this.#selectorSource(
                                  atom.start + 1,
                                  atom.end - 1,
                              ),
                          ),
                          ")",
                      ]
                    : this.#atom(atom, {}),
            ),
        );
    }

    /** `@function --name(--param <type>: default) returns <type>`. */
    #functionPrelude(atoms: Atom[]): Doc {
        let [head, ...rest] = atoms;
        const parts: Doc[] = [];
        // `--name ( )` is a function too
        if (
            head?.type === "Identifier" &&
            rest[0]?.type === "SimpleBlock" &&
            rest[0].open === "("
        ) {
            const block = rest[0];
            head = {
                type: "Function",
                start: head.start,
                end: block.end,
                name: head.value,
                open: block.start,
                children: block.children,
                closed: true,
            };
            rest = rest.slice(1);
        }
        if (head?.type === "Function") {
            const params = Css.#split(
                this.#atoms(head.children, head.open + 1, head.end - 1),
            );
            if (params.length > 1 && params.at(-1)?.length === 0) params.pop();
            const docs = params
                .filter((param) => param.length > 0)
                .map((param) => this.#syntaxValues(param));
            parts.push(
                head.name,
                docs.length > 0
                    ? this.#parenthesized(join([",", line], docs))
                    : "()",
            );
        } else if (head) parts.push(this.#atom(head, {}));
        if (rest.length > 0) parts.push(" ", this.#syntaxValues(rest));
        return parts;
    }

    /** Values with syntax types like `<length>`, and `name: default`. */
    #syntaxValues(atoms: Atom[]): Doc {
        const parts: Doc[] = [];
        for (let index = 0; index < atoms.length; index++) {
            const atom = atoms[index] as Atom;
            if (atom.type === "Delimiter" && atom.value === "<") {
                let close = index + 1;
                while (
                    close < atoms.length &&
                    !(
                        atoms[close]?.type === "Delimiter" &&
                        (atoms[close] as C.Delimiter).value === ">"
                    )
                )
                    close++;
                const inner = atoms
                    .slice(index + 1, close)
                    .map((part) => this.#atom(part, {}));
                if (parts.length > 0) parts.push(" ");
                parts.push(["<", ...inner, ">"]);
                index = close;
                continue;
            }
            if (atom.type === "Colon") {
                parts.push(":");
                continue;
            }
            if (parts.length > 0) parts.push(" ");
            parts.push(this.#atom(atom, {}));
        }
        return parts;
    }
}

type Mode = "media" | "supports" | "container";

/** A group, named apart from the `group` parameters of callbacks. */
const group_ = group;
