import { declarations } from "../../analysis/css.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noDuplicateCustomProperties",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["css"],
    create: (context) => ({
        CssBlock(block) {
            const parent = context.cssParent(block);
            if (!parent || parent.type === "Stylesheet") return;
            const seen = new Set<string>();
            for (const declaration of declarations(block)) {
                if (!declaration.property.startsWith("--")) continue;
                if (seen.has(declaration.property)) {
                    context.report(
                        {
                            start: declaration.start,
                            end: declaration.propertyEnd,
                        },
                        "Duplicate custom properties can lead to unexpected behavior and may override previous declarations unintentionally.",
                    );
                    return;
                }
                seen.add(declaration.property);
            }
        },
    }),
});
