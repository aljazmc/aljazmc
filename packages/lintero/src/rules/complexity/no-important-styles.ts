import { rule } from "../../rules.js";

export default rule({
    name: "noImportantStyles",
    group: "complexity",
    severity: "warn",
    recommended: true,
    fix: "unsafe",
    languages: ["css"],
    create: (context) => ({
        CssDeclaration(node) {
            const important = node.important;
            if (!important) return;
            const before = node.value.at(-1)?.end ?? node.colon + 1;
            context.report(
                important,
                "Avoid the use of the !important style.",
                {
                    message: "Remove the style.",
                    edits: [{ start: before, end: important.end, text: "" }],
                },
            );
        },
    }),
});
