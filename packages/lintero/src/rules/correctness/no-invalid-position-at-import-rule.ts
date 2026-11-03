import { rule } from "../../rules.js";

export default rule({
    name: "noInvalidPositionAtImportRule",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["css"],
    create: (context) => ({
        CssStylesheet(sheet) {
            let invalid = false;
            for (const item of sheet.children) {
                if (item.type === "Empty") continue;
                if (item.type !== "AtRule") {
                    invalid = true;
                    continue;
                }
                // `@charset` and `@layer` statements may come first
                if (item.keyword === "charset" || item.keyword === "layer")
                    continue;
                if (item.keyword === "import") {
                    if (invalid)
                        context.report(
                            { start: item.start + 1, end: item.end },
                            "This @import is in the wrong position.",
                        );
                    continue;
                }
                invalid = true;
            }
        },
    }),
});
