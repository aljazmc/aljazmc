import { rule } from "../../rules.js";

export default rule({
    name: "noConstAssign",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    create: (context) => ({
        "Program:exit"() {
            for (const binding of context.semantic.bindings)
                if (
                    binding.declarations.some(
                        ({ kind }) => kind === "const" || kind === "using",
                    )
                )
                    for (const reference of binding.references)
                        if (reference.write)
                            context.report(
                                reference,
                                `Can't assign ${binding.name} because it's a constant.`,
                            );
        },
    }),
});
