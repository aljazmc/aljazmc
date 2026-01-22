import { rule } from "../../rules.js";

export default rule({
    name: "noEmptyPattern",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        ObjectPattern(node) {
            if (node.properties.length === 0)
                context.report(node, "Unexpected empty object pattern.");
        },
        ArrayPattern(node) {
            if (node.elements.length === 0)
                context.report(node, "Unexpected empty array pattern.");
        },
    }),
});
