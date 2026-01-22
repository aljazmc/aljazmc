import { rule } from "../../rules.js";

export default rule({
    name: "useNamespaceKeyword",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "safe",
    languages: ["ts"],
    create: (context) => ({
        TSModuleDeclaration(node) {
            if (node.kind !== "module" || node.id.type !== "Identifier") return;
            const keyword = context.find("module", node.start);
            context.report(
                keyword,
                "Use the namespace keyword instead of the outdated module keyword.",
                {
                    message: "Use namespace instead.",
                    edits: [{ ...keyword, text: "namespace" }],
                },
            );
        },
    }),
});
