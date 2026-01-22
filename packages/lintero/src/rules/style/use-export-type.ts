import type { Node } from "@aljazmc/syntax";
import type { Binding } from "../../analysis/semantic.js";
import { rule } from "../../rules.js";

export default rule<{ style?: "auto" | "inlineType" | "separatedType" }>({
    name: "useExportType",
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
            if (/\.d\.[cm]?ts$/.test(context.file)) return;
            /** Whether a binding only declares types, like interfaces or type only imports. */
            const typeOnly = (binding: Binding) =>
                binding.declarations.every((declaration) => {
                    if (["interface", "typeAlias"].includes(declaration.kind))
                        return true;
                    if (declaration.kind !== "import") return false;
                    const specifier = declaration.node;
                    const statement = context.parent(specifier);
                    return (
                        (specifier.type === "ImportSpecifier" &&
                            specifier.importKind === "type") ||
                        (statement?.type === "ImportDeclaration" &&
                            statement.importKind === "type")
                    );
                });

            for (const statement of context.program.type === "Program"
                ? context.program.body
                : []) {
                if (
                    statement.type !== "ExportNamedDeclaration" ||
                    statement.source ||
                    statement.declaration
                )
                    continue;
                if (statement.specifiers.length === 0) continue;
                const specifiers = statement.specifiers.flatMap((specifier) => {
                    if (specifier.type !== "ExportSpecifier") return [];
                    const reference = semantic.referenced(specifier.local);
                    const inline = specifier.exportKind === "type";
                    const types =
                        inline ||
                        statement.exportKind === "type" ||
                        (reference?.binding !== undefined &&
                            typeOnly(reference.binding));
                    return [{ specifier, inline, types }];
                });

                const range = {
                    start: context.token(statement.start + "export".length)
                        .start,
                    end: statement.end,
                };
                if (statement.exportKind === "type") {
                    if (style === "inlineType")
                        context.report(range, "Some exports are only types.");
                    continue;
                }
                if (specifiers.every(({ types }) => types)) {
                    if (style === "inlineType") {
                        if (!specifiers.every(({ inline }) => inline))
                            context.report(
                                range,
                                "Some exports are only types.",
                            );
                        continue;
                    }
                    context.report(range, "All exports are only types.", {
                        message: "Use export type.",
                        edits: [
                            {
                                start: statement.start + "export".length,
                                end: statement.start + "export".length,
                                text: " type",
                            },
                            ...specifiers
                                .filter(({ inline }) => inline)
                                .map(({ specifier }) => ({
                                    start: specifier.start,
                                    end: context.token(specifier.start + 4)
                                        .start,
                                    text: "",
                                })),
                        ],
                    });
                    continue;
                }
                if (
                    style === "separatedType" &&
                    specifiers.some(({ inline }) => inline)
                ) {
                    context.report(
                        range,
                        "Separate type exports from other exports.",
                    );
                    continue;
                }
                for (const { specifier, types, inline } of specifiers)
                    if (types && !inline)
                        context.report(
                            specifier as Node,
                            "Some exports are only types.",
                            {
                                message: "Add inline type keywords.",
                                edits: [
                                    {
                                        start: specifier.start,
                                        end: specifier.start,
                                        text: "type ",
                                    },
                                ],
                            },
                        );
            }
        },
    }),
});
