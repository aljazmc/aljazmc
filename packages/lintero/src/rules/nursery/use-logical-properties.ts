import type { Css } from "@aljazmc/syntax";
import { decode } from "../../analysis/css.js";
import {
    LONGHAND_SUB_PROPERTIES_OF_SHORTHAND_PROPERTIES,
    SHORTHAND_PROPERTIES,
} from "../../analysis/css-keywords.js";
import table from "../../analysis/table.js";
import { rule } from "../../rules.js";

/** Physical properties and their logical replacements, left to right and right to left. */
const properties: Record<string, [string, string]> = table({
    width: ["inline-size", "inline-size"],
    "min-width": ["min-inline-size", "min-inline-size"],
    "max-width": ["max-inline-size", "max-inline-size"],
    height: ["block-size", "block-size"],
    "min-height": ["min-block-size", "min-block-size"],
    "max-height": ["max-block-size", "max-block-size"],
    top: ["inset-block-start", "inset-block-start"],
    right: ["inset-inline-end", "inset-inline-start"],
    bottom: ["inset-block-end", "inset-block-end"],
    left: ["inset-inline-start", "inset-inline-end"],
    "margin-top": ["margin-block-start", "margin-block-start"],
    "margin-right": ["margin-inline-end", "margin-inline-start"],
    "margin-bottom": ["margin-block-end", "margin-block-end"],
    "margin-left": ["margin-inline-start", "margin-inline-end"],
    "padding-top": ["padding-block-start", "padding-block-start"],
    "padding-right": ["padding-inline-end", "padding-inline-start"],
    "padding-bottom": ["padding-block-end", "padding-block-end"],
    "padding-left": ["padding-inline-start", "padding-inline-end"],
    "border-top": ["border-block-start", "border-block-start"],
    "border-top-color": [
        "border-block-start-color",
        "border-block-start-color",
    ],
    "border-top-style": [
        "border-block-start-style",
        "border-block-start-style",
    ],
    "border-top-width": [
        "border-block-start-width",
        "border-block-start-width",
    ],
    "border-bottom": ["border-block-end", "border-block-end"],
    "border-bottom-color": ["border-block-end-color", "border-block-end-color"],
    "border-bottom-style": ["border-block-end-style", "border-block-end-style"],
    "border-bottom-width": ["border-block-end-width", "border-block-end-width"],
    "border-left": ["border-inline-start", "border-inline-end"],
    "border-left-color": [
        "border-inline-start-color",
        "border-inline-end-color",
    ],
    "border-left-style": [
        "border-inline-start-style",
        "border-inline-end-style",
    ],
    "border-left-width": [
        "border-inline-start-width",
        "border-inline-end-width",
    ],
    "border-right": ["border-inline-end", "border-inline-start"],
    "border-right-color": [
        "border-inline-end-color",
        "border-inline-start-color",
    ],
    "border-right-style": [
        "border-inline-end-style",
        "border-inline-start-style",
    ],
    "border-right-width": [
        "border-inline-end-width",
        "border-inline-start-width",
    ],
    "border-top-left-radius": [
        "border-start-start-radius",
        "border-start-end-radius",
    ],
    "border-top-right-radius": [
        "border-start-end-radius",
        "border-start-start-radius",
    ],
    "border-bottom-left-radius": [
        "border-end-start-radius",
        "border-end-end-radius",
    ],
    "border-bottom-right-radius": [
        "border-end-end-radius",
        "border-end-start-radius",
    ],
});

/** Physical shorthands of four sides and their block and inline logical shorthands. */
const shorthands: Record<string, [string, string]> = table({
    margin: ["margin-block", "margin-inline"],
    padding: ["padding-block", "padding-inline"],
    inset: ["inset-block", "inset-inline"],
    "scroll-margin": ["scroll-margin-block", "scroll-margin-inline"],
    "scroll-padding": ["scroll-padding-block", "scroll-padding-inline"],
    "border-width": ["border-block-width", "border-inline-width"],
    "border-style": ["border-block-style", "border-inline-style"],
    "border-color": ["border-block-color", "border-inline-color"],
});

/** Logical start and end longhands, and the shorthand that sets both. */
const merges: [string, string, string][] = [
    "margin-block",
    "margin-inline",
    "padding-block",
    "padding-inline",
    "inset-block",
    "inset-inline",
    "scroll-margin-block",
    "scroll-margin-inline",
    "scroll-padding-block",
    "scroll-padding-inline",
    "border-block",
    "border-inline",
    "border-block-width",
    "border-inline-width",
    "border-block-style",
    "border-inline-style",
    "border-block-color",
    "border-inline-color",
].map((shorthand) => {
    const [, base = "", suffix = ""] =
        /^(.*-(?:block|inline))(-.*)?$/.exec(shorthand) ?? [];
    return [`${base}-start${suffix}`, `${base}-end${suffix}`, shorthand];
});

const longhands = (property: string): readonly string[] =>
    LONGHAND_SUB_PROPERTIES_OF_SHORTHAND_PROPERTIES[
        SHORTHAND_PROPERTIES.indexOf(property)
    ] ?? [];

/** The color, style and width of a logical border side. */
const borderSide = (property: string): string[] =>
    /^border-(?:block|inline)-(?:start|end)$/.test(property)
        ? ["color", "style", "width"].map((part) => `${property}-${part}`)
        : [];

/** Whether a declaration of `property` sets `target`, also through shorthands or physical names. */
const writes = (property: string, target: string, rtl: boolean): boolean => {
    if (property === "all") return true;
    const logical = (name: string) => properties[name]?.[rtl ? 1 : 0] ?? name;
    const from = logical(property);
    const to = logical(target);
    if (from === to) return true;
    const parts = (name: string) => {
        const merge = merges.find(([, , shorthand]) => shorthand === name);
        return [
            ...longhands(name),
            ...borderSide(name),
            ...(merge ? [merge[0], merge[1]] : []),
        ];
    };
    return (
        parts(from).some((part) => writes(part, to, rtl)) ||
        parts(to).some((part) => writes(from, part, rtl))
    );
};

const cssWide = new Set([
    "initial",
    "inherit",
    "unset",
    "revert",
    "revert-layer",
]);

const isCssWide = (value: Css.Value): boolean =>
    value.type === "Identifier" &&
    cssWide.has(decode(value.value).toLowerCase());

/** Whether a value may expand to several values, like `var()`, at any depth. */
const isDynamic = (value: Css.Value): boolean =>
    (value.type === "Function" &&
        ["var", "env", "attr", "if"].includes(
            decode(value.name).toLowerCase(),
        )) ||
    ((value.type === "Function" || value.type === "SimpleBlock") &&
        value.children.some(isDynamic));

const startEnd = (value: string, rtl: boolean): string | undefined =>
    value === "left"
        ? rtl
            ? "end"
            : "start"
        : value === "right"
          ? rtl
              ? "start"
              : "end"
          : undefined;

const inline = (value: string, rtl: boolean): string | undefined =>
    value === "left"
        ? rtl
            ? "inline-end"
            : "inline-start"
        : value === "right"
          ? rtl
              ? "inline-start"
              : "inline-end"
          : undefined;

const logicalValue = (
    property: string,
    value: string,
    rtl: boolean,
): string | undefined => {
    if (property === "frame-sizing")
        return value === "content-width"
            ? "content-inline-size"
            : value === "content-height"
              ? "content-block-size"
              : undefined;
    if (property === "float" || property === "clear") return inline(value, rtl);
    if (
        property === "text-align" ||
        property === "justify-items" ||
        property === "justify-self"
    )
        return startEnd(value, rtl);
    return undefined;
};

export default rule<{ direction?: "ltr" | "rtl" }>({
    name: "useLogicalProperties",
    group: "nursery",
    severity: "warn",
    recommended: false,
    fix: "unsafe",
    languages: ["css"],
    options: { direction: "ltr" },
    create: (context) => {
        const rtl = () => context.options.direction === "rtl";
        const replace = (
            node: { start: number; end: number },
            message: string,
            replacement?: string,
        ) =>
            context.report(
                node,
                message,
                replacement === undefined
                    ? undefined
                    : {
                          message: "Use the logical CSS replacement.",
                          edits: [
                              {
                                  start: node.start,
                                  end: node.end,
                                  text: replacement,
                              },
                          ],
                      },
            );
        /** Identifiers in `anchor()` and `anchor-size()`, at any depth. */
        const functions = (list: readonly Css.Value[]) => {
            for (const value of list) {
                if (value.type !== "Function") continue;
                const name = decode(value.name).toLowerCase();
                const kind =
                    name === "anchor-size"
                        ? "size"
                        : name === "anchor"
                          ? "side"
                          : null;
                const visit = (children: readonly Css.Value[]) => {
                    for (const child of children) {
                        if (child.type === "Identifier" && kind) {
                            const physical = decode(child.value).toLowerCase();
                            const replacement =
                                kind === "size"
                                    ? physical === "width"
                                        ? "self-inline"
                                        : physical === "height"
                                          ? "self-block"
                                          : undefined
                                    : physical === "top"
                                      ? "start"
                                      : physical === "bottom"
                                        ? "end"
                                        : startEnd(physical, rtl());
                            if (replacement)
                                replace(
                                    child,
                                    kind === "size"
                                        ? "Use a logical size in anchor-size()."
                                        : "Use a logical side in anchor().",
                                    replacement,
                                );
                        }
                        if (child.type === "Function") functions([child]);
                        else if (child.type === "SimpleBlock")
                            visit(child.children);
                    }
                };
                visit(value.children);
            }
        };
        const text = (node: Css.Value) => context.slice(node);
        const important = (node: Css.Declaration) =>
            node.important ? ` ${context.slice(node.important)}` : "";
        /** The end of the values and `!important` of a declaration, before its `;`. */
        const valueEnd = (node: Css.Declaration) =>
            node.important?.end ?? node.value.at(-1)?.end ?? node.colon + 1;
        const commented = (start: number, end: number) =>
            (context.css?.comments ?? []).some(
                (comment) => comment.start < end && comment.end > start,
            );

        /** `margin: 1px 2px` sets physical sides, `margin-block` and `margin-inline` logical ones. */
        const split = (node: Css.Declaration, name: string) => {
            const logical = shorthands[name];
            const values = node.value;
            if (!logical || values.length < 2 || values.length > 4) return;
            if (values.some(isCssWide)) return;
            const message =
                "Use logical CSS longhands instead of a multi-value physical shorthand.";
            const range = { start: node.start, end: node.propertyEnd };
            if (values.some(isDynamic)) {
                context.report(range, message);
                return;
            }
            const [blockName, inlineName] = logical;
            const four = values.length === 4;
            const pick = (indices: number[]) => {
                const parts = indices.map((index) =>
                    text(values[index] as Css.Value),
                );
                return parts.length === 2 && parts[0] === parts[1]
                    ? (parts[0] as string)
                    : parts.join(" ");
            };
            const block = pick(values.length === 2 ? [0] : [0, 2]);
            const inline = pick(four ? (rtl() ? [1, 3] : [3, 1]) : [1]);
            const colon = context.slice({
                start: node.propertyEnd,
                end: (values[0] as Css.Value).start,
            });
            context.report(range, message, {
                message: `Replace with ${blockName} and ${inlineName}.`,
                edits: [
                    {
                        start: node.start,
                        end: valueEnd(node),
                        text: `${blockName}${colon}${block}${important(node)}; ${inlineName}: ${inline}${important(node)}`,
                    },
                ],
            });
        };

        /** `margin-block-start` and `margin-block-end` next to each other can be `margin-block`. */
        const merge = (node: Css.Declaration, name: string) => {
            const group = merges.find(
                ([start, end]) => name === start || name === end,
            );
            const parent = context.cssParent(node);
            if (
                !group ||
                !parent ||
                parent.type === "Stylesheet" ||
                !parent.block
            )
                return;
            const [startName, endName, target] = group;
            const items = parent.block.children;
            const named = (property: string) =>
                items.filter(
                    (item): item is Css.Declaration =>
                        item.type === "Declaration" &&
                        item.property.toLowerCase() === property,
                );
            const starts = named(startName);
            const ends = named(endName);
            const [start] = starts;
            const [end] = ends;
            if (starts.length !== 1 || ends.length !== 1 || !start || !end)
                return;
            const [first, second] =
                start.start < end.start ? [start, end] : [end, start];
            if (first !== node) return;
            const between = items.slice(
                items.indexOf(first) + 1,
                items.indexOf(second),
            );
            const same =
                start.value.length === end.value.length &&
                start.value.every(
                    (value, index) =>
                        text(value) === text(end.value[index] as Css.Value),
                );
            if (
                between.some((item) => item.type !== "Declaration") ||
                !start.important !== !end.important ||
                start.value.length === 0 ||
                end.value.length === 0 ||
                [...start.value, ...end.value].some(
                    (value) => isDynamic(value) || isCssWide(value),
                ) ||
                (/^border-(?:block|inline)$/.test(target) && !same) ||
                commented(first.start, second.end) ||
                between.some(
                    (item) =>
                        item.type === "Declaration" &&
                        [startName, endName].some((side) =>
                            writes(item.property.toLowerCase(), side, rtl()),
                        ),
                )
            )
                return;
            const values = (same ? start.value : [...start.value, ...end.value])
                .map(text)
                .join(" ");
            const previous = items[items.indexOf(second) - 1] as Css.Item;
            context.report(
                { start: node.start, end: node.propertyEnd },
                "These logical longhands can be combined into a shorthand.",
                {
                    message: `Combine these properties as ${target}.`,
                    edits: [
                        {
                            start: first.start,
                            end: first.value.at(-1)?.end ?? first.propertyEnd,
                            text: `${target}${context.slice({ start: first.propertyEnd, end: (first.value[0] as Css.Value).start })}${values}`,
                        },
                        { start: previous.end, end: second.end, text: "" },
                    ],
                },
            );
        };

        return {
            CssDeclaration(node) {
                const name = node.property.toLowerCase();
                const replacement = properties[name];
                if (replacement)
                    replace(
                        { start: node.start, end: node.propertyEnd },
                        "Use logical CSS properties over physical ones.",
                        replacement[rtl() ? 1 : 0],
                    );
                split(node, name);
                merge(node, name);
                const legacy =
                    name === "justify-items" &&
                    node.value.some(
                        (value) =>
                            value.type === "Identifier" &&
                            decode(value.value).toLowerCase() === "legacy",
                    );
                for (const value of node.value) {
                    if (value.type !== "Identifier") continue;
                    const physical = decode(value.value).toLowerCase();
                    const sided = physical === "left" || physical === "right";
                    if (
                        (name === "justify-content" && sided) ||
                        (legacy && sided)
                    ) {
                        replace(
                            value,
                            "Use logical CSS values over physical ones.",
                        );
                        continue;
                    }
                    const logical = logicalValue(name, physical, rtl());
                    if (logical)
                        replace(
                            value,
                            "Use logical CSS values over physical ones.",
                            logical,
                        );
                }
                functions(node.value);
            },
        };
    },
});
