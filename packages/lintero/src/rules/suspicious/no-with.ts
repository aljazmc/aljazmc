import { rule } from "../../rules.js";

export default rule({
    name: "noWith",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        WithStatement(node) {
            context.report(node, "Unexpected use of with statement.");
        },
    }),
});
