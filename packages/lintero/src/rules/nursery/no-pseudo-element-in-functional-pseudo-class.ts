import { compounds } from "../../analysis/css.js";
import { rule } from "../../rules.js";

/** The pseudo classes whose selectors must match elements. */
const functional = new Set(["is", "where", "not", "matches", "has"]);

/** Pseudo elements of CSS 2, that browsers also accept with a single colon. */
const legacy = new Set(["after", "before", "first-letter", "first-line"]);

export default rule({
    name: "noPseudoElementInFunctionalPseudoClass",
    group: "nursery",
    severity: "error",
    recommended: false,
    fix: "none",
    languages: ["css"],
    create: (context) => ({
        CssRule(node) {
            if (!node.selectors) return;
            for (const { compound, pseudos } of compounds(node.selectors)) {
                // only the closest pseudo class counts, `:host()` in `:is()` is not checked
                const closest = pseudos[0];
                if (
                    closest?.type !== "PseudoClassSelector" ||
                    !functional.has(closest.name.toLowerCase())
                )
                    continue;
                for (const child of compound.children)
                    if (
                        child.type === "PseudoElementSelector" ||
                        (child.type === "PseudoClassSelector" &&
                            !child.argument &&
                            legacy.has(child.name.toLowerCase()))
                    )
                        context.report(
                            child,
                            `This pseudo-element can't be used inside :${closest.name}().`,
                        );
            }
        },
    }),
});
