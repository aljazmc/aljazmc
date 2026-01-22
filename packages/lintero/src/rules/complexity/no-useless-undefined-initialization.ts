import { rule } from "../../rules.js";

export default rule({
    name: "noUselessUndefinedInitialization",
    group: "complexity",
    severity: "info",
    recommended: true,
    fix: "safe",
    languages: ["js"],
    create: (context) => ({
        "VariableDeclaration:exit"(node) {
            if (
                node.kind === "const" ||
                node.kind.includes("using") ||
                node.declare
            )
                return;
            for (const declarator of node.declarations) {
                const { id, init } = declarator;
                if (
                    id.type !== "Identifier" ||
                    init?.type !== "Identifier" ||
                    init.name !== "undefined"
                )
                    continue;
                // exported variables are read and written by others
                if (context.semantic.declared(id)?.exported) continue;
                const assignment = context.find(
                    "=",
                    (id.typeAnnotation ?? id).end,
                );
                context.report(
                    { start: assignment.start, end: init.end },
                    `It's not necessary to initialize ${id.name} to undefined.`,
                    {
                        message: "Remove undefined initialization.",
                        edits: [
                            {
                                start: (id.typeAnnotation ?? id).end,
                                end: init.end,
                                text: "",
                            },
                        ],
                    },
                );
            }
        },
    }),
});
