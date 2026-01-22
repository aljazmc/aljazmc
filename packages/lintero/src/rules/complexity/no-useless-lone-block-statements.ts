import type { Node } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

/** Statements that make a block a scope of their own. */
const scoped = (statement: Node): boolean =>
    (statement.type === "VariableDeclaration" && statement.kind !== "var") ||
    statement.type === "ClassDeclaration" ||
    statement.type === "FunctionDeclaration" ||
    statement.type === "TSEnumDeclaration" ||
    statement.type === "TSModuleDeclaration";

export default rule({
    name: "noUselessLoneBlockStatements",
    group: "complexity",
    severity: "info",
    recommended: true,
    fix: "safe",
    languages: ["js"],
    create: (context) => ({
        BlockStatement(node) {
            const parent = context.parent(node);
            if (
                parent?.type !== "BlockStatement" &&
                parent?.type !== "Program" &&
                parent?.type !== "StaticBlock" &&
                parent?.type !== "SwitchCase" &&
                parent?.type !== "TSModuleBlock"
            )
                return;
            // a block as the whole case is a common style
            if (parent.type === "SwitchCase" && parent.consequent.length === 1)
                return;
            if (node.body.some(scoped)) return;

            const first = node.body[0];
            const last = node.body.at(-1);
            context.report(
                node,
                "This block statement doesn't serve any purpose and can be safely removed.",
                {
                    message: "Remove redundant block.",
                    edits: [
                        {
                            start: node.start,
                            end: node.end,
                            text:
                                first && last
                                    ? context.slice({
                                          start: first.start,
                                          end: last.end,
                                      })
                                    : "",
                        },
                    ],
                },
            );
        },
    }),
});
