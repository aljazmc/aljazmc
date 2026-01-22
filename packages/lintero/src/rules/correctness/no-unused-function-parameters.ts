import { rule } from "../../rules.js";
import { bare, used } from "./no-unused-variables.js";

export default rule<{ ignoreRestSiblings?: boolean }>({
    name: "noUnusedFunctionParameters",
    group: "correctness",
    severity: "warn",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    options: { ignoreRestSiblings: true },
    create: (context) => ({
        "Program:exit"() {
            for (const binding of context.semantic.bindings) {
                const [declaration] = binding.declarations;
                if (
                    declaration?.kind !== "parameter" ||
                    binding.name.startsWith("_") ||
                    binding.name === "this" ||
                    declaration.ambient ||
                    bare(declaration, context.text) ||
                    (context.options.ignoreRestSiblings &&
                        declaration.restSibling) ||
                    used(binding)
                )
                    continue;
                const fn = declaration.node;
                // signatures without bodies, and parameter properties, are not checked
                if (!("body" in fn) || !fn.body) continue;
                if (
                    context.parent(declaration.id)?.type ===
                    "TSParameterProperty"
                )
                    continue;
                context.report(
                    declaration,
                    `This parameter ${binding.name} is unused.`,
                    {
                        message: `If this is intentional, prepend ${binding.name} with an underscore.`,
                        edits: [
                            {
                                start: declaration.start,
                                end: declaration.start,
                                text: "_",
                            },
                        ],
                    },
                );
            }
        },
    }),
});
