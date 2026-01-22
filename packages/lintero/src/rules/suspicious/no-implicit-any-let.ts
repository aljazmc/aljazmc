import { rule } from "../../rules.js";

export default rule({
    name: "noImplicitAnyLet",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["ts"],
    create: (context) => ({
        VariableDeclaration(node) {
            if (node.declare || (node.kind !== "let" && node.kind !== "var"))
                return;
            const parent = context.parent(node);
            if (
                parent?.type === "ForInStatement" ||
                parent?.type === "ForOfStatement"
            )
                return;
            for (const declarator of node.declarations)
                if (
                    declarator.id.type === "Identifier" &&
                    !declarator.id.typeAnnotation &&
                    !declarator.init
                )
                    context.report(
                        declarator.id,
                        "This variable implicitly has the any type.",
                    );
        },
    }),
});
