import { rule } from "../../rules.js";

export default rule({
    name: "noFunctionAssign",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        "Program:exit"() {
            for (const binding of context.semantic.bindings) {
                const declaration = binding.declarations.find(
                    ({ kind, local }) => kind === "function" && !local,
                );
                if (
                    declaration &&
                    binding.references.some(({ write }) => write)
                )
                    context.report(
                        declaration,
                        "Do not reassign a function declaration.",
                    );
            }
        },
    }),
});
