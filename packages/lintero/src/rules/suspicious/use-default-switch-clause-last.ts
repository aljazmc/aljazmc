import { rule } from "../../rules.js";

export default rule({
    name: "useDefaultSwitchClauseLast",
    group: "suspicious",
    severity: "warn",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        SwitchStatement(node) {
            const index = node.cases.findIndex(
                (clause) => clause.test === null,
            );
            const clause = node.cases[index];
            if (!clause || index === node.cases.length - 1) return;
            context.report(
                clause,
                "The default clause should be the last switch clause.",
            );
        },
    }),
});
