import { rule } from "../../rules.js";

export default rule({
    name: "noQwikUseVisibleTask",
    group: "correctness",
    severity: "error",
    recommended: false,
    fix: "none",
    languages: ["js"],
    domains: { qwik: "recommended" },
    create: (context) => ({
        CallExpression(node) {
            if (
                node.callee.type === "Identifier" &&
                node.callee.name === "useVisibleTask$"
            )
                context.report(
                    node,
                    "Avoid useVisibleTask$ for non-interactive initialization",
                );
        },
    }),
});
