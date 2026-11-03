import { compounds } from "../../analysis/css.js";
import {
    HTML_TAGS,
    MATH_ML_TAGS,
    SVG_TAGS,
} from "../../analysis/css-keywords.js";
import { rule } from "../../rules.js";

const html = new Set(HTML_TAGS);
const svg = new Set(SVG_TAGS);
const math = new Set(MATH_ML_TAGS);

/** Pseudo elements whose argument is a view transition name, not a type. */
const transitions = /^view-transition(?:-group|-image-pair|-old|-new)?$/i;

/** Like Biome: HTML and MathML names in any case, SVG ones as written, and custom elements. */
const known = (name: string): boolean => {
    const lower = name.toLowerCase();
    return (
        html.has(lower) ||
        svg.has(name) ||
        math.has(lower) ||
        (name.includes("-") && name === lower)
    );
};

export default rule({
    name: "noUnknownTypeSelector",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["css"],
    create: (context) => ({
        CssRule(node) {
            if (!node.selectors) return;
            for (const { compound, pseudos } of compounds(node.selectors)) {
                const element = compound.element;
                if (element?.type !== "TypeSelector") continue;
                const pseudo = pseudos[0];
                if (
                    pseudo?.type === "PseudoElementSelector" &&
                    transitions.test(pseudo.name)
                )
                    continue;
                if (!known(element.name))
                    context.report(
                        element,
                        "Unknown type selector is not allowed.",
                    );
            }
        },
    }),
});
