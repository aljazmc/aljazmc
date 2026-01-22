import { rule } from "../../rules.js";

const loops = new Set([
    "ForStatement",
    "ForInStatement",
    "ForOfStatement",
    "WhileStatement",
    "DoWhileStatement",
]);

export default rule<{ allowedLabels: string[] }>({
    name: "noConfusingLabels",
    group: "suspicious",
    severity: "warn",
    recommended: true,
    fix: "none",
    languages: ["js"],
    options: { allowedLabels: [] },
    create: (context) => ({
        LabeledStatement(node) {
            if (loops.has(node.body.type)) return;
            if (context.options.allowedLabels.includes(node.label.name)) return;
            // Svelte's reactive statements
            if (node.label.name === "$" && context.file.endsWith(".svelte"))
                return;
            context.report(node.label, "Unexpected label.");
        },
    }),
});
