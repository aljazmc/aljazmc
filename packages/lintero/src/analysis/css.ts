import type { Css } from "@aljazmc/syntax";
import {
    BASIC_KEYWORDS,
    FONT_FAMILY_KEYWORDS,
    FONT_SIZE_KEYWORDS,
    FONT_STRETCH_KEYWORDS,
    FONT_STYLE_KEYWORDS,
    FONT_VARIANTS_KEYWORDS,
    FONT_WEIGHT_ABSOLUTE_KEYWORDS,
    FONT_WEIGHT_NUMERIC_KEYWORDS,
    LINE_HEIGHT_KEYWORDS,
    SYSTEM_FAMILY_NAME_KEYWORDS,
} from "./css-keywords.js";

/** Values and the values of their functions and blocks, depth first. */
export function* values(list: readonly Css.Value[]): Generator<Css.Value> {
    for (const value of list) {
        yield value;
        if (value.type === "Function" || value.type === "SimpleBlock")
            yield* values(value.children);
        else if (value.type === "Url") yield* values(value.modifiers);
    }
}

/** The declarations directly in a block. */
export function declarations(block: Css.Block | null): Css.Declaration[] {
    return (block?.children ?? []).filter(
        (child): child is Css.Declaration => child.type === "Declaration",
    );
}

/** Whether an at-rule is `@keyframes`, maybe vendor prefixed. */
export function isKeyframes(node: Css.AtRule): boolean {
    return /^(?:-[a-z]+-)?keyframes$/.test(node.keyword);
}

/** A compound selector and the pseudo class or element whose argument it is in, if any. */
export interface Compound {
    compound: Css.CompoundSelector;
    /** The pseudo selectors whose arguments it is in, from the closest. */
    pseudos: (Css.PseudoClassSelector | Css.PseudoElementSelector)[];
}

/** Every compound selector of a list, also those in the arguments of pseudo classes and elements. */
export function* compounds(
    list: Css.SelectorList,
    pseudos: (Css.PseudoClassSelector | Css.PseudoElementSelector)[] = [],
): Generator<Compound> {
    for (const selector of list.children)
        for (const compound of selector.children) {
            yield { compound, pseudos };
            for (const child of compound.children) {
                if (
                    child.type !== "PseudoClassSelector" &&
                    child.type !== "PseudoElementSelector"
                )
                    continue;
                const argument = child.argument;
                if (argument?.type === "SelectorList")
                    yield* compounds(argument, [child, ...pseudos]);
                else if (argument?.type === "Nth" && argument.selectors)
                    yield* compounds(argument.selectors, [child, ...pseudos]);
            }
        }
}

/** Whether a declaration is in `@keyframes`. */
export function inKeyframes(
    ancestors: Iterable<Css.Rule | Css.AtRule>,
): boolean {
    for (const ancestor of ancestors)
        if (ancestor.type === "AtRule" && isKeyframes(ancestor)) return true;
    return false;
}

/** A part of a `font` or `font-family` value: a value, or a delimiter between values. */
export type FontComponent =
    | { kind: "value"; value: Css.Value }
    | { kind: "comma" | "slash" | "other" };

/** A font family name: one string or identifier, or identifiers written together like `Times New Roman`. */
export interface FontName {
    values: (Css.StringValue | Css.Identifier)[];
    /** Whether it is a single string or identifier. */
    single: boolean;
}

export function fontComponents(list: readonly Css.Value[]): FontComponent[] {
    return list.map((value) => {
        if (value.type === "Comma") return { kind: "comma" };
        if (value.type === "Delimiter")
            return { kind: value.value === "/" ? "slash" : "other" };
        return { kind: "value", value };
    });
}

/** The text of a font name without quotes, to compare names. */
export function fontNameText(name: FontName, text: string): string {
    return name.values
        .map((value) =>
            value.type === "String"
                ? value.raw.slice(1, -1).trim()
                : text.slice(value.start, value.end).trim(),
        )
        .join(" ");
}

/** The range of a font name. */
export function fontNameRange(name: FontName): { start: number; end: number } {
    return {
        start: (name.values[0] as Css.Value).start,
        end: (name.values.at(-1) as Css.Value).end,
    };
}

const set = (...lists: readonly (readonly string[])[]): Set<string> =>
    new Set(lists.flat());

export const fontFamilyKeywords = set(BASIC_KEYWORDS, FONT_FAMILY_KEYWORDS);
export const systemFamilyKeywords = set(
    BASIC_KEYWORDS,
    SYSTEM_FAMILY_NAME_KEYWORDS,
);
const shorthandKeywords = set(
    BASIC_KEYWORDS,
    FONT_STYLE_KEYWORDS,
    FONT_VARIANTS_KEYWORDS,
    FONT_WEIGHT_ABSOLUTE_KEYWORDS,
    FONT_WEIGHT_NUMERIC_KEYWORDS,
    FONT_STRETCH_KEYWORDS,
    FONT_SIZE_KEYWORDS,
    LINE_HEIGHT_KEYWORDS,
    FONT_FAMILY_KEYWORDS,
);

/** Whether a value is `var(…)`. */
export function isVariable(text: string): boolean {
    return text.toLowerCase().startsWith("var(");
}

/** The font families of a `font` shorthand or `font-family` value. */
export function fontFamilies(
    components: FontComponent[],
    text: string,
): FontName[] {
    const families: FontName[] = [];
    let collected: Css.Identifier[] = [];
    const flush = () => {
        if (collected.length > 0)
            families.push({ values: collected, single: false });
        collected = [];
    };
    for (const [index, component] of components.entries()) {
        if (component.kind !== "value") {
            flush();
            continue;
        }
        const value = component.value;
        const lower = text.slice(value.start, value.end).trim().toLowerCase();
        if (isVariable(lower)) continue;
        if (shorthandKeywords.has(lower) && !fontFamilyKeywords.has(lower))
            continue;
        if (value.type === "Dimension" || value.type === "Percentage") continue;
        const previous = components[index - 1];
        const before = components[index - 2];
        if (
            previous?.kind === "slash" &&
            before?.kind === "value" &&
            (before.value.type === "Dimension" ||
                before.value.type === "Percentage")
        )
            continue;
        if (value.type === "Number") continue;
        if (value.type === "Identifier") {
            const next = components[index + 1];
            if (next && next.kind !== "value") {
                if (collected.length === 0)
                    families.push({ values: [value], single: true });
                else collected.push(value);
            } else if (index + 1 < components.length) collected.push(value);
            else if (collected.length === 0)
                families.push({ values: [value], single: true });
            else {
                collected.push(value);
                flush();
            }
        } else if (value.type === "String")
            families.push({ values: [value], single: true });
    }
    return families;
}

/** The strings of a stylesheet, found in its text outside comments. */
export function strings(
    text: string,
    comments: readonly Css.Comment[],
): { start: number; end: number; raw: string }[] {
    const found: { start: number; end: number; raw: string }[] = [];
    let comment = 0;
    for (let index = 0; index < text.length; index++) {
        while (
            comment < comments.length &&
            (comments[comment] as Css.Comment).end <= index
        )
            comment++;
        const current = comments[comment];
        if (current && current.start <= index) {
            index = current.end - 1;
            continue;
        }
        const char = text[index];
        if (char === "\\") {
            index++;
            continue;
        }
        if (char !== '"' && char !== "'") continue;
        const start = index;
        for (index++; index < text.length; index++) {
            const inner = text[index];
            if (inner === "\\") index++;
            else if (inner === char || inner === "\n") break;
        }
        found.push({
            start,
            end: index + 1,
            raw: text.slice(start, index + 1),
        });
    }
    return found;
}

/** An identifier with its escapes decoded, like `\\6d onospace` as `monospace`. */
export function decode(identifier: string): string {
    return identifier.replace(
        /\\(?:([0-9a-fA-F]{1,6})[ \t\n\r\f]?|([^\n]))/g,
        (_, hex: string | undefined, char: string | undefined) =>
            hex
                ? String.fromCodePoint(Number.parseInt(hex, 16) || 0xfffd)
                : (char ?? ""),
    );
}
