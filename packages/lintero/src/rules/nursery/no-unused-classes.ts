import { compounds } from "../../analysis/css.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noUnusedClasses",
    group: "nursery",
    severity: "info",
    recommended: false,
    fix: "none",
    languages: ["css"],
    domains: { project: "all" },
    create: (context) => ({
        CssRule(node) {
            if (!node.selectors) return;
            // like Biome without files that import the stylesheet, no class is referenced
            for (const { compound, pseudos } of compounds(node.selectors)) {
                if (
                    pseudos.some(
                        (pseudo) => pseudo.name.toLowerCase() === "global",
                    )
                )
                    continue;
                for (const child of compound.children)
                    if (child.type === "ClassSelector")
                        context.report(
                            child,
                            `The CSS class ${child.name} is not referenced in any HTML or JSX file.`,
                        );
            }
        },
    }),
});
