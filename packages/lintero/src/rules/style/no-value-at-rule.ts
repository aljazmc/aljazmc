import { rule } from "../../rules.js";

export default rule({
    name: "noValueAtRule",
    group: "style",
    severity: "info",
    recommended: false,
    fix: "none",
    languages: ["css"],
    create: (context) => ({
        CssAtRule(node) {
            // `@value` is CSS Modules syntax
            if (node.keyword === "value" && context.cssModules)
                context.report(node, "Use of @value rule is disallowed");
        },
    }),
});
