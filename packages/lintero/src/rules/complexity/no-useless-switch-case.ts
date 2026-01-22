import { rule } from "../../rules.js";

export default rule({
    name: "noUselessSwitchCase",
    group: "complexity",
    severity: "info",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    create: (context) => ({
        SwitchStatement(node) {
            const index = node.cases.findIndex(
                (clause) => clause.test === null,
            );
            const fallback = node.cases[index];
            if (!fallback) return;
            const report = (clause: (typeof node.cases)[number]) =>
                context.report(clause, "Useless case clause.", {
                    message: "Remove the useless case.",
                    edits: [{ start: clause.start, end: clause.end, text: "" }],
                });

            for (let before = index - 1; before >= 0; before--) {
                const clause = node.cases[before];
                if (!clause || clause.consequent.length > 0) break;
                report(clause);
            }
            if (fallback.consequent.length > 0) return;
            for (const clause of node.cases.slice(index + 1)) {
                report(clause);
                if (clause.consequent.length > 0) break;
            }
        },
    }),
});
