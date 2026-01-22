import type { Node } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

export default rule({
    name: "noUselessEmptyExport",
    group: "complexity",
    severity: "info",
    recommended: true,
    fix: "safe",
    languages: ["js"],
    create: (context) => {
        const check = (body: Node[]) => {
            const modular = (statement: Node) =>
                [
                    "ImportDeclaration",
                    "ExportNamedDeclaration",
                    "ExportDefaultDeclaration",
                    "ExportAllDeclaration",
                    "TSExportAssignment",
                    "TSImportEqualsDeclaration",
                ].includes(statement.type);
            for (const statement of body) {
                if (
                    statement.type !== "ExportNamedDeclaration" ||
                    statement.declaration ||
                    statement.source ||
                    statement.specifiers.length > 0
                )
                    continue;
                if (body.some((other) => other !== statement && modular(other)))
                    context.report(
                        statement,
                        "This empty export is useless because there's another export or import.",
                        {
                            message: "Remove this useless empty export.",
                            edits: [
                                {
                                    start: statement.start,
                                    end: statement.end,
                                    text: "",
                                },
                            ],
                        },
                    );
            }
        };
        return {
            Program: (node) => check(node.body),
            TSModuleBlock: (node) => check(node.body),
        };
    },
});
