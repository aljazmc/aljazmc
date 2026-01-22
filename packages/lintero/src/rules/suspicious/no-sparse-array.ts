import { rule } from "../../rules.js";

export default rule({
    name: "noSparseArray",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    create: (context) => ({
        ArrayExpression(node) {
            if (node.elements.includes(null))
                context.report(node, "This array contains an empty slots..");
        },
    }),
});
