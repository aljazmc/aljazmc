import { rule } from "../../rules.js";

export default rule({
    name: "noClassAssign",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        "Program:exit"() {
            for (const binding of context.semantic.bindings)
                if (binding.declarations.some(({ kind }) => kind === "class"))
                    for (const reference of binding.references)
                        if (reference.write)
                            context.report(
                                reference,
                                `The class '${binding.name}' is reassigned.`,
                            );
        },
    }),
});
