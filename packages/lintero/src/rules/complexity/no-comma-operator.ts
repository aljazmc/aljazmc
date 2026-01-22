import { rule } from "../../rules.js";

export default rule({
    name: "noCommaOperator",
    group: "complexity",
    severity: "warn",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        SequenceExpression(node) {
            const parent = context.parent(node);
            if (parent?.type === "ForStatement" && parent.test !== node) return;
            // like Biome, one diagnostic at the last comma of the sequence
            const last = node.expressions.at(-1);
            const previous = node.expressions.at(-2);
            if (last && previous)
                context.report(
                    context.find(",", previous.end, last.start),
                    "The comma operator is disallowed.",
                );
        },
    }),
});
