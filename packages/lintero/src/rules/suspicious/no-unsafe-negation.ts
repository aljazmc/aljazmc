import { rule } from "../../rules.js";

export default rule({
    name: "noUnsafeNegation",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    create: (context) => ({
        BinaryExpression(node) {
            const { left } = node;
            if (
                (node.operator === "in" || node.operator === "instanceof") &&
                left.type === "UnaryExpression" &&
                left.operator === "!" &&
                !left.parenthesized
            )
                context.report(
                    node,
                    "The negation operator is used unsafely on the left side of this binary expression.",
                    {
                        message: "Wrap the expression with a parenthesis",
                        edits: [
                            {
                                start: left.start,
                                end: left.argument.start,
                                text: "!(",
                            },
                            { start: node.end, end: node.end, text: ")" },
                        ],
                    },
                );
        },
    }),
});
