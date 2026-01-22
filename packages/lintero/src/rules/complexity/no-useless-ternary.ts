import { rule } from "../../rules.js";

export default rule({
    name: "noUselessTernary",
    group: "complexity",
    severity: "info",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    create: (context) => ({
        ConditionalExpression(node) {
            if (
                node.consequent.type === "BooleanLiteral" &&
                node.alternate.type === "BooleanLiteral"
            )
                context.report(
                    node,
                    "Unnecessary use of boolean literals in conditional expression.",
                );
        },
    }),
});
