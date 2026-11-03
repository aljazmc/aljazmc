import { values } from "../../analysis/css.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noHexColors",
    group: "style",
    severity: "info",
    recommended: false,
    fix: "none",
    languages: ["css"],
    create: (context) => ({
        CssDeclaration(node) {
            for (const value of values(node.value))
                if (value.type === "Hash")
                    context.report(value, "Unexpected hex color.");
        },
    }),
});
