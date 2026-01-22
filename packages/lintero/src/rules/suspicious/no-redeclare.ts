import type { BindingKind, Declaration } from "../../analysis/semantic.js";
import { rule } from "../../rules.js";

const spaces = (kind: BindingKind): string[] => {
    switch (kind) {
        case "interface":
        case "typeAlias":
        case "typeParameter":
        case "infer":
            return ["type"];
        case "class":
        case "enum":
        case "import":
        case "namespace":
            return ["type", "value"];
        default:
            return ["value"];
    }
};

/** TypeScript merges these declarations of one name. */
const merges = (a: Declaration, b: Declaration): boolean => {
    const kinds = [a.kind, b.kind].sort().join(" ");
    // namespaces merge with anything
    if (a.kind === "namespace" || b.kind === "namespace") return true;
    if (["enum enum", "interface interface", "class interface"].includes(kinds))
        return true;
    // overload signatures and their implementation
    if (kinds === "function function")
        return (
            a.node.type === "TSDeclareFunction" ||
            b.node.type === "TSDeclareFunction"
        );
    return false;
};

export default rule({
    name: "noRedeclare",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        "Program:exit"() {
            const { semantic } = context;
            for (const binding of semantic.bindings) {
                // a `var` in a function body redeclares a parameter of it
                const params =
                    binding.scope.node.type === "BlockStatement"
                        ? binding.scope.parent
                        : undefined;
                const param =
                    params?.kind === "function"
                        ? params.bindings.get(binding.name)
                        : undefined;
                if (
                    param?.declarations.some(({ kind }) => kind === "parameter")
                )
                    for (const declaration of binding.declarations)
                        if (declaration.kind === "var")
                            context.report(
                                declaration,
                                `'${binding.name}' is redeclared in the same scope.`,
                            );

                const { declarations } = binding;
                for (const [index, declaration] of declarations.entries()) {
                    if (
                        ["enumMember", "infer"].includes(declaration.kind) ||
                        declaration.local
                    )
                        continue;
                    const conflict = declarations.slice(0, index).some(
                        (other) =>
                            other.kind !== "infer" &&
                            // Biome sees a type alias and a function of one name as a redeclaration
                            ([other.kind, declaration.kind].sort().join(" ") ===
                                "function typeAlias" ||
                                spaces(other.kind).some((space) =>
                                    spaces(declaration.kind).includes(space),
                                )) &&
                            !merges(other, declaration),
                    );
                    if (conflict)
                        context.report(
                            declaration,
                            `'${binding.name}' is redeclared in the same scope.`,
                        );
                }
            }
        },
    }),
});
