import type { Node } from "@aljazmc/syntax";
import type { Binding } from "../../analysis/semantic.js";
import { rule } from "../../rules.js";

/** Whether every use of a binding is as a type, or in a `typeof` type query. */
export const typeOnly = (binding: Binding): boolean =>
    binding.references.length > 0 &&
    binding.references.every(
        (reference) => reference.type || (!reference.read && !reference.write),
    );

export default rule<{ style?: "auto" | "inlineType" | "separatedType" }>({
    name: "useImportType",
    group: "style",
    severity: "warn",
    recommended: true,
    fix: "safe",
    languages: ["ts"],
    options: { style: "auto" },
    create: (context) => ({
        "Program:exit"() {
            const { semantic } = context;
            const style = context.options.style ?? "auto";
            const classic =
                context.settings.javascript.jsxRuntime === "reactClassic";
            const program = context.program;
            // declaration files have no runtime imports
            if (
                program.type !== "Program" ||
                /\.d\.[cm]?ts$/.test(context.file)
            )
                return;

            for (const statement of program.body) {
                if (
                    statement.type !== "ImportDeclaration" ||
                    statement.attributes.length > 0
                )
                    continue;
                if (statement.importKind === "type") continue;
                // import attributes, even empty ones, keep the import as is
                if (
                    /^\s*(with|assert)\b/.test(
                        context.text.slice(
                            context.skip(statement.source.end),
                            statement.end,
                        ),
                    )
                )
                    continue;
                const range = {
                    start: context.token(statement.start + "import".length)
                        .start,
                    end: statement.source.start,
                };
                const specifiers = statement.specifiers.flatMap((specifier) => {
                    if (!("local" in specifier)) return [];
                    const binding = semantic.declared(specifier.local as Node);
                    const inline =
                        specifier.type === "ImportSpecifier" &&
                        specifier.importKind === "type";
                    const unused = !binding || binding.references.length === 0;
                    const types =
                        inline ||
                        (!!binding &&
                            typeOnly(binding) &&
                            !(classic && binding.name === "React"));
                    return [{ specifier, inline, unused, types }];
                });
                const used = specifiers.filter(
                    ({ unused, inline }) => !unused || inline,
                );
                if (used.length === 0) continue;

                if (
                    used.every(({ types }) => types) &&
                    used.length === specifiers.length
                ) {
                    if (
                        style === "inlineType" &&
                        used.every(
                            ({ specifier }) =>
                                specifier.type === "ImportSpecifier",
                        )
                    ) {
                        if (used.every(({ inline }) => inline)) continue;
                        context.report(
                            range,
                            "Some named imports are only used as types.",
                        );
                        continue;
                    }
                    const named = specifiers.filter(
                        ({ specifier }) => specifier.type === "ImportSpecifier",
                    );
                    const fixable =
                        specifiers.length === named.length ||
                        specifiers.length === 1;
                    context.report(
                        range,
                        "All these imports are only used as types.",
                        fixable
                            ? {
                                  message: "Use import type.",
                                  edits: [
                                      {
                                          start:
                                              statement.start + "import".length,
                                          end:
                                              statement.start + "import".length,
                                          text: " type",
                                      },
                                      ...named
                                          .filter(({ inline }) => inline)
                                          .map(({ specifier }) => ({
                                              start: specifier.start,
                                              end: context.token(
                                                  specifier.start + 4,
                                              ).start,
                                              text: "",
                                          })),
                                  ],
                              }
                            : undefined,
                    );
                    continue;
                }

                if (
                    style === "separatedType" &&
                    specifiers.some(({ inline }) => inline)
                ) {
                    context.report(
                        range,
                        "Some named imports are only used as types.",
                    );
                    continue;
                }
                const missing = specifiers.filter(
                    ({ specifier, types, inline, unused }) =>
                        specifier.type === "ImportSpecifier" &&
                        types &&
                        !inline &&
                        !unused,
                );
                if (missing.length > 0)
                    context.report(
                        range,
                        "Some named imports are only used as types.",
                        {
                            message: "Add inline type keywords.",
                            edits: missing.map(({ specifier }) => ({
                                start: specifier.start,
                                end: specifier.start,
                                text: "type ",
                            })),
                        },
                    );
            }
        },
    }),
});
