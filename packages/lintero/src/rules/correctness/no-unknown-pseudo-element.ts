import { compounds } from "../../analysis/css.js";
import {
    LEVEL_ONE_AND_TWO_PSEUDO_ELEMENTS,
    OTHER_PSEUDO_ELEMENTS,
    SHADOW_TREE_PSEUDO_ELEMENTS,
    VENDOR_SPECIFIC_PSEUDO_ELEMENTS,
} from "../../analysis/css-keywords.js";
import { rule } from "../../rules.js";

const known = new Set([
    ...LEVEL_ONE_AND_TWO_PSEUDO_ELEMENTS,
    ...VENDOR_SPECIFIC_PSEUDO_ELEMENTS,
    ...SHADOW_TREE_PSEUDO_ELEMENTS,
    ...OTHER_PSEUDO_ELEMENTS,
]);

export default rule<{ ignore?: string[] }>({
    name: "noUnknownPseudoElement",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["css"],
    options: { ignore: [] },
    create: (context) => ({
        CssRule(node) {
            if (!node.selectors) return;
            for (const { compound } of compounds(node.selectors))
                for (const child of compound.children) {
                    if (child.type !== "PseudoElementSelector") continue;
                    const lower = child.name.toLowerCase();
                    if (
                        known.has(lower) ||
                        /^-(?:webkit|moz|ms|o)-/.test(child.name) ||
                        (context.cssModules &&
                            (lower === "global" || lower === "local")) ||
                        (context.options.ignore ?? []).some(
                            (name) => name.toLowerCase() === lower,
                        )
                    )
                        continue;
                    // the element is after the colons and the trivia after them
                    const start = context.text.indexOf(
                        child.name,
                        child.start + 2,
                    );
                    const range = { start, end: child.end };
                    context.report(
                        range,
                        `Unexpected unknown pseudo-elements: ${context.slice(range)}`,
                    );
                }
        },
    }),
});
