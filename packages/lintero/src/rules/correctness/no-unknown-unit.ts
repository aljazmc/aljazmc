import type { Css } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

/** Units Biome knows. */
const units = new Set(
    "em rem ex rex cap rcap ch rch ic ric lh rlh vw svw lvw dvw vh svh lvh dvh vi svi lvi dvi vb svb lvb dvb vmin svmin lvmin dvmin vmax svmax lvmax dvmax cm mm q in pc pt px mozmm rpx cqw cqh cqi cqb cqmin cqmax deg grad rad turn s ms hz khz dpi dpcm dppx x fr".split(
        " ",
    ),
);

/** Types of `attr()` that are no units. */
const attrTypes = new Set(
    "raw-string string ident color number percentage length angle time frequency flex url integer".split(
        " ",
    ),
);

const resolutions = /^(?:resolution|min-resolution|max-resolution)$/i;

export default rule({
    name: "noUnknownUnit",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["css"],
    create: (context) => {
        /** Checks the dimensions of values, `x` is a resolution only in some places. */
        const check = (list: readonly Css.Value[], allowX: boolean) => {
            for (const value of list) {
                if (value.type === "Dimension") {
                    const lower = value.unit.toLowerCase();
                    // like Biome, units with escapes are unknown dimensions too
                    const unknown =
                        !units.has(lower) || value.unit.includes("\\");
                    if (
                        unknown ||
                        (lower === "x" && value.unit === "x" && !allowX)
                    ) {
                        if (lower === "x" && value.unit !== "x") continue;
                        const start = value.end - value.unit.length;
                        context.report(
                            { start, end: value.end },
                            `Unexpected unknown unit: ${value.unit}`,
                        );
                    }
                } else if (value.type === "Function") {
                    // the type of `attr()` may be a unit
                    const type = value.children[1];
                    if (
                        /^attr$/i.test(value.name) &&
                        type?.type === "Identifier" &&
                        !units.has(type.value.toLowerCase()) &&
                        !attrTypes.has(type.value.toLowerCase())
                    )
                        context.report(
                            type,
                            `Unexpected unknown unit: ${type.value}`,
                        );
                    check(
                        value.children,
                        allowX || /image-set$/i.test(value.name),
                    );
                } else if (value.type === "SimpleBlock") {
                    const colon = value.children.findIndex(
                        (child) => child.type === "Colon",
                    );
                    const name = value.children[0];
                    const resolution =
                        colon > 0 &&
                        name?.type === "Identifier" &&
                        resolutions.test(name.value);
                    check(value.children, allowX || resolution);
                } else if (value.type === "Url") check(value.modifiers, allowX);
            }
        };
        return {
            CssDeclaration(node) {
                check(node.value, /^image-resolution$/i.test(node.property));
            },
            CssAtRule(node) {
                if (
                    /^(?:media|custom-media|import|container|supports)$/.test(
                        node.keyword,
                    )
                )
                    check(node.prelude, false);
            },
        };
    },
});
