import type { Css } from "@aljazmc/syntax";
import { decode } from "../../analysis/css.js";
import { LENGTH_UNITS } from "../../analysis/css-keywords.js";
import { rule } from "../../rules.js";

const lengths = new Set(LENGTH_UNITS);

const math = new Set(
    "abs acos asin atan atan2 calc calc-size clamp cos exp hypot log max min mod pow progress random rem round sign sin sqrt tan".split(
        " ",
    ),
);

export default rule({
    name: "noZeroLengthUnit",
    group: "nursery",
    severity: "info",
    recommended: true,
    fix: "unsafe",
    languages: ["css"],
    create: (context) => {
        const report = (value: Css.Dimension) => {
            const start = value.end - value.unit.length;
            context.report(
                { start, end: value.end },
                `The unit ${value.unit} is unnecessary on a zero length.`,
                {
                    message: "Remove the unit.",
                    edits: [{ start, end: value.end, text: "" }],
                },
            );
        };
        const check = (list: readonly Css.Value[], property: string | null) => {
            for (const [index, value] of list.entries()) {
                if (value.type === "Dimension") {
                    if (
                        Number(value.value) !== 0 ||
                        !lengths.has(value.unit.toLowerCase())
                    )
                        continue;
                    // a line height after `/` in `font` may be a length
                    const previous = list[index - 1];
                    if (
                        property === "font" &&
                        previous?.type === "Delimiter" &&
                        previous.value === "/"
                    )
                        continue;
                    report(value);
                } else if (value.type === "Function") {
                    const name = decode(value.name).toLowerCase();
                    // in math functions, a zero length keeps its type
                    if (math.has(name.replace(/^-(?:moz|ms|o|webkit)-/, "")))
                        continue;
                    check(value.children, property);
                } else if (value.type === "SimpleBlock")
                    check(value.children, property);
            }
        };
        return {
            CssDeclaration(node) {
                const name = decode(node.property)
                    .toLowerCase()
                    .replace(/^-(?:moz|ms|o|webkit)-/, "");
                if (name === "line-height" || name === "flex") return;
                check(node.value, name);
            },
            CssAtRule(node) {
                if (
                    /^(?:media|custom-media|container|import|supports|function)$/.test(
                        node.keyword,
                    )
                )
                    check(node.prelude, null);
            },
        };
    },
});
