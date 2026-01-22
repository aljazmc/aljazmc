import type { Node } from "@aljazmc/syntax";
import { rule } from "../../rules.js";
import { used } from "./no-unused-variables.js";

export default rule({
    name: "noUnusedImports",
    group: "correctness",
    severity: "warn",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    create: (context) => {
        let jsx = false;
        return {
            JSXElement() {
                jsx = true;
            },
            "Program:exit"() {
                // declaration files import types for their declarations
                if (/\.d\.[cm]?ts$/.test(context.file)) return;
                const { semantic } = context;
                const classic =
                    context.settings.javascript.jsxRuntime === "reactClassic";
                const unused = (local: Node) => {
                    const binding = semantic.declared(local);
                    if (!binding || used(binding) || binding.exported)
                        return false;
                    return !(classic && jsx && binding.name === "React");
                };

                for (const statement of context.program.type === "Program"
                    ? walk(context.program.body)
                    : []) {
                    if (statement.type === "TSImportEqualsDeclaration") {
                        if (unused(statement.id))
                            context.report(
                                statement,
                                "This import is unused.",
                                {
                                    message: "Remove the unused import.",
                                    edits: [
                                        {
                                            start: statement.start,
                                            end: statement.end,
                                            text: "",
                                        },
                                    ],
                                },
                            );
                        continue;
                    }
                    if (
                        statement.type !== "ImportDeclaration" ||
                        statement.specifiers.length === 0
                    )
                        continue;

                    const specifiers = statement.specifiers.filter(
                        (specifier) =>
                            "local" in specifier &&
                            unused(specifier.local as Node),
                    );
                    if (specifiers.length === 0) continue;

                    if (specifiers.length === statement.specifiers.length)
                        context.report(
                            specifiers.length === 1 &&
                                specifiers[0]?.type ===
                                    "ImportNamespaceSpecifier"
                                ? specifiers[0].local
                                : {
                                      start: context.token(
                                          statement.start + "import".length,
                                      ).start,
                                      end: statement.source.start,
                                  },
                            "This import is unused.",
                            {
                                message: "Remove the unused imports.",
                                edits: [
                                    {
                                        start: statement.start,
                                        end: statement.end,
                                        text: "",
                                    },
                                ],
                            },
                        );
                    else
                        for (const specifier of specifiers)
                            context.report(
                                specifier,
                                "Several of these imports are unused.",
                            );
                }
            },
        };

        /** Import statements, also in namespaces. */
        function* walk(statements: Node[]): Generator<Node> {
            for (const statement of statements) {
                yield statement;
                if (statement.type === "TSModuleDeclaration" && statement.body)
                    yield* walk(statement.body.body);
            }
        }
    },
});
