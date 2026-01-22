import { rule } from "../../rules.js";

export default rule({
    name: "noLabelVar",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        LabeledStatement(node) {
            const { name } = node.label;
            const scope = context.semantic.scopeAt(node.start);
            if (context.semantic.lookup(name, scope))
                context.report(
                    node.label,
                    `Do not use the ${name} variable name as a label`,
                );
        },
    }),
});
