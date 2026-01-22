import { rule } from "../../rules.js";

export default rule({
    name: "noSwitchDeclarations",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "safe",
    languages: ["js"],
    create: (context) => ({
        SwitchCase(node) {
            const first = node.consequent[0];
            const last = node.consequent.at(-1);
            for (const statement of node.consequent) {
                const lexical =
                    statement.type === "VariableDeclaration" ||
                    statement.type === "FunctionDeclaration" ||
                    statement.type === "ClassDeclaration";
                if (!lexical || !first || !last) continue;
                context.report(
                    statement,
                    "Other switch clauses can erroneously access this declaration.\nWrap the declaration in a block to restrict its access to the switch clause.",
                    {
                        message: "Wrap the declaration in a block.",
                        edits: [
                            {
                                start: first.start,
                                end: first.start,
                                text: "{ ",
                            },
                            { start: last.end, end: last.end, text: " }" },
                        ],
                    },
                );
            }
        },
    }),
});
