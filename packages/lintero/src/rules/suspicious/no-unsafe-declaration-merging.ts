import { rule } from "../../rules.js";

export default rule({
    name: "noUnsafeDeclarationMerging",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["ts"],
    create: (context) => ({
        "Program:exit"() {
            for (const binding of context.semantic.bindings) {
                const kinds = binding.declarations.map(({ kind }) => kind);
                if (!kinds.includes("interface")) continue;
                for (const declaration of binding.declarations)
                    if (declaration.kind === "class" && !declaration.ambient)
                        context.report(
                            declaration,
                            "This class is unsafely merged with an interface.",
                        );
            }
        },
    }),
});
