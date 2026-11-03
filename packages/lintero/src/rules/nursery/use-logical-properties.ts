import type { Css } from "@aljazmc/syntax";
import { decode } from "../../analysis/css.js";
import { rule } from "../../rules.js";

/** Physical properties and their logical replacements, left to right and right to left. */
const properties: Record<string, [string, string]> = {
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
};

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
