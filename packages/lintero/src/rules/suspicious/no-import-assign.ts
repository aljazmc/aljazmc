import { rule } from "../../rules.js";

export default rule({
    name: "noImportAssign",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        "Program:exit"() {
            for (const binding of context.semantic.bindings)
                if (
                    binding.declarations.some(
                        ({ kind, node }) =>
                            kind === "import" &&
                            node.type !== "TSImportEqualsDeclaration",
                    )
                )
                    for (const reference of binding.references)
                        if (reference.write)
                            context.report(
                                reference,
                                `The imported variable ${binding.name} is read-only`,
                            );
        },
    }),
});
