import { rule } from "../../rules.js";

export default rule({
    name: "noCatchAssign",
    group: "suspicious",
    severity: "warn",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        "Program:exit"() {
            for (const binding of context.semantic.bindings)
                if (binding.declarations.some(({ kind }) => kind === "catch"))
                    for (const reference of binding.references)
                        if (reference.write)
                            context.report(
                                reference,
                                "Reassigning a catch parameter is confusing.",
                            );
        },
    }),
});
