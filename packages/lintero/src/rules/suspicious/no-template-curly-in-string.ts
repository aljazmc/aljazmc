import { rule } from "../../rules.js";

export default rule({
    name: "noTemplateCurlyInString",
    group: "suspicious",
    severity: "warn",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        StringLiteral(node) {
            const match = /\$\{[^}]+\}/.exec(node.raw);
            if (!match) return;
            const start = node.start + match.index;
            context.report(
                { start, end: start + match[0].length },
                "Unexpected template string placeholder.",
            );
        },
    }),
});
