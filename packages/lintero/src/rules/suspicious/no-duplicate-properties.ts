import { declarations, inKeyframes } from "../../analysis/css.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noDuplicateProperties",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["css"],
    create: (context) => ({
        CssBlock(block) {
            const parent = context.cssParent(block);
            if (!parent || parent.type === "Stylesheet") return;
            if (inKeyframes([parent, ...context.cssAncestors(parent)])) return;
            const seen = new Set<string>();
            // like Biome, the first duplicate of each block
            for (const declaration of declarations(block)) {
                if (declaration.property.startsWith("--")) continue;
                if (seen.has(declaration.property)) {
                    context.report(
                        {
                            start: declaration.start,
                            end: declaration.propertyEnd,
                        },
                        "Duplicate properties can lead to unexpected behavior and may override previous declarations unintentionally.",
                    );
                    return;
                }
                seen.add(declaration.property);
            }
        },
    }),
});
