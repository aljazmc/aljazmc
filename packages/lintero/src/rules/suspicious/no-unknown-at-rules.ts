import type { Css } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

/** Known at-rules, the others are unknown. */
const known = new Set(
    "charset color-profile container counter-style custom-media document -moz-document font-face font-feature-values font-palette-values function import keyframes -webkit-keyframes -moz-keyframes -o-keyframes -ms-keyframes layer media namespace page position-try property scope starting-style supports view-transition".split(
        " ",
    ),
);

/** Margin rules of `@page`. */
const margins = new Set(
    "top-left-corner top-left top-center top-right top-right-corner bottom-left-corner bottom-left bottom-center bottom-right bottom-right-corner left-top left-middle left-bottom right-top right-middle right-bottom".split(
        " ",
    ),
);

/** Feature value blocks of `@font-feature-values`. */
const features = new Set(
    "stylistic historical-forms styleset character-variant swash ornaments annotation".split(
        " ",
    ),
);

export default rule<{ ignore?: string[] }>({
    name: "noUnknownAtRules",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["css"],
    options: { ignore: [] },
    create: (context) => ({
        CssAtRule(node) {
            const keyword = node.keyword;
            if (known.has(keyword)) return;
            if (keyword === "value" && context.cssModules) return;
            const parent = context.cssParent(node) as
                | Css.AtRule
                | Css.Rule
                | undefined;
            if (parent?.type === "AtRule") {
                if (parent.keyword === "page" && margins.has(keyword)) return;
                if (
                    parent.keyword === "font-feature-values" &&
                    features.has(keyword)
                )
                    return;
            }
            if (
                (context.options.ignore ?? []).some(
                    (name) => name.toLowerCase() === keyword,
                )
            )
                return;
            const start = node.start + 1;
            context.report(
                { start, end: start + node.name.length },
                `Unexpected unknown at-rule: ${node.name} `,
            );
        },
    }),
});
