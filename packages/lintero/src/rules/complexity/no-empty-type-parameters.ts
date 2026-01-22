import type { Node } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

export default rule({
    name: "noEmptyTypeParameters",
    group: "complexity",
    severity: "warn",
    recommended: true,
    fix: "none",
    languages: ["ts"],
    create: (context) => {
        const check = (parameters: Node | null) => {
            if (
                parameters?.type === "TSTypeParameterDeclaration" &&
                parameters.params.length === 0
            )
                context.report(
                    parameters,
                    "Unexpected empty type parameter list.",
                );
        };
        return {
            TSInterfaceDeclaration(node) {
                check(node.typeParameters);
            },
            TSTypeAliasDeclaration(node) {
                check(node.typeParameters);
            },
        };
    },
});
