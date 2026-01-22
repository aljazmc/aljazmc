import { rule } from "../../rules.js";

export default rule({
    name: "noArguments",
    group: "complexity",
    severity: "warn",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        "Program:exit"() {
            for (const reference of context.semantic.references)
                if (
                    reference.name === "arguments" &&
                    !reference.binding &&
                    !reference.type
                )
                    context.report(
                        reference,
                        "Use the rest parameters instead of arguments.",
                    );
        },
    }),
});
