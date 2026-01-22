import Globals from "../../analysis/globals.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noGlobalAssign",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        "Program:exit"() {
            for (const reference of context.semantic.references)
                if (
                    reference.write &&
                    !reference.binding &&
                    !reference.type &&
                    Globals.builtin.has(reference.name) &&
                    !context.settings.javascript.globals.includes(
                        reference.name,
                    )
                )
                    context.report(
                        reference,
                        "A global variable should not be reassigned.",
                    );
        },
    }),
});
