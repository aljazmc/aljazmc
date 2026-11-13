import { declarations, isKeyframes } from "../../analysis/css.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noImportantInKeyframe",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["css"],
    create: (context) => ({
        CssAtRule(node) {
            if (!isKeyframes(node) || !node.block) return;
            // the first one of each keyframes
            for (const item of node.block.children) {
                if (item.type !== "Rule") continue;
                const important = declarations(item.block).find(
                    (declaration) => declaration.important,
                )?.important;
                if (important) {
                    context.report(
                        important,
                        "Unexpected !important within a keyframes declaration.",
                    );
                    return;
                }
            }
        },
    }),
});
