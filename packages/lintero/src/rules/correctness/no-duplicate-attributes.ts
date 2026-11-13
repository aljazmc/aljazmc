import { rule } from "../../rules.js";

export default rule({
    name: "noDuplicateAttributes",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["html"],
    create: (context) => ({
        HtmlElement(node) {
            // names are compared as written
            const seen = new Set<string>();
            for (const attribute of node.attributes) {
                if (seen.has(attribute.name))
                    context.report(
                        attribute,
                        `Duplicate attribute '${attribute.name}'.`,
                    );
                else seen.add(attribute.name);
            }
        },
    }),
});
