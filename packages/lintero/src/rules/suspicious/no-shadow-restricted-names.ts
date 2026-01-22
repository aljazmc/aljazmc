import type { Node } from "@aljazmc/syntax";
import Globals from "../../analysis/globals.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noShadowRestrictedNames",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => {
        const signature = (params: Node[]) => {
            for (const param of params)
                if (
                    param.type === "Identifier" &&
                    Globals.restricted.has(param.name)
                )
                    context.report(
                        param,
                        `Do not shadow the global "${param.name}" property.`,
                    );
        };
        return {
            // parameters of signatures declare no bindings, but shadow too
            TSMethodSignature: (node) => signature(node.params),
            TSFunctionType: (node) => signature(node.params),
            TSCallSignatureDeclaration: (node) => signature(node.params),
            TSConstructSignatureDeclaration: (node) => signature(node.params),
            TSConstructorType: (node) => signature(node.params),
            "Program:exit"() {
                for (const binding of context.semantic.bindings) {
                    if (!Globals.restricted.has(binding.name)) continue;
                    for (const declaration of binding.declarations)
                        if (
                            ![
                                "interface",
                                "typeAlias",
                                "typeParameter",
                                "infer",
                                "enumMember",
                                "namespace",
                            ].includes(declaration.kind)
                        )
                            context.report(
                                declaration,
                                `Do not shadow the global "${binding.name}" property.`,
                            );
                }
            },
        };
    },
});
