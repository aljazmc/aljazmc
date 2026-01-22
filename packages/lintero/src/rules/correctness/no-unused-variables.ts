import type {
    Binding,
    BindingKind,
    Declaration,
} from "../../analysis/semantic.js";
import { rule } from "../../rules.js";

type Ignored = Partial<
    Record<
        | "*"
        | "class"
        | "function"
        | "interface"
        | "typeAlias"
        | "typeParameter"
        | "variable",
        string[]
    >
>;

const labels: Partial<Record<BindingKind, string>> = {
    class: "class",
    enum: "enum",
    function: "function",
    interface: "interface",
    namespace: "namespace",
    typeAlias: "type alias",
    typeParameter: "type parameter",
};

const option: Partial<Record<BindingKind, keyof Ignored>> = {
    class: "class",
    function: "function",
    interface: "interface",
    typeAlias: "typeAlias",
    typeParameter: "typeParameter",
    var: "variable",
    let: "variable",
    const: "variable",
    using: "variable",
};

/** Whether a binding is read, or used as a type, outside of its own declaration. */
export const used = (binding: Binding): boolean =>
    binding.references.some(
        (reference) =>
            (reference.read || reference.type) &&
            !binding.declarations.some(
                (declaration) =>
                    ["function", "class"].includes(declaration.kind) &&
                    reference.start >= declaration.node.start &&
                    reference.end <= declaration.node.end,
            ) &&
            !binding.declarations.some(
                (declaration) =>
                    declaration.node.type === "VariableDeclarator" &&
                    declaration.init !== null &&
                    reference.start >= declaration.init.start &&
                    reference.end <= declaration.init.end &&
                    [
                        "ArrowFunctionExpression",
                        "FunctionExpression",
                        "ClassExpression",
                    ].includes(declaration.init.type),
            ),
    );

/**
 * Whether a parameter is a lone arrow function parameter without parentheses,
 * which Biome checks as a variable rather than as a parameter.
 */
export const bare = (declaration: Declaration, text: string): boolean => {
    const fn = declaration.node;
    if (fn.type !== "ArrowFunctionExpression" || fn.params.length !== 1)
        return false;
    const [param] = fn.params;
    if (param !== declaration.id) return false;
    return !/\(\s*$/.test(text.slice(fn.start, param.start));
};

export default rule<{ ignoreRestSiblings?: boolean; ignore?: Ignored }>({
    name: "noUnusedVariables",
    group: "correctness",
    severity: "warn",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    options: { ignoreRestSiblings: true, ignore: {} },
    create: (context) => {
        const { ignoreRestSiblings, ignore = {} } = context.options;
        const ignored = (name: string, kind: BindingKind) => {
            const lists = [ignore["*"], ignore[option[kind] ?? "variable"]];
            return lists.some(
                (list) => list?.includes("*") || list?.includes(name),
            );
        };
        const reportable = (declaration: Declaration) =>
            !declaration.ambient &&
            !declaration.local &&
            !(ignoreRestSiblings && declaration.restSibling) &&
            !["import", "enumMember", "infer"].includes(declaration.kind) &&
            (declaration.kind !== "parameter" ||
                bare(declaration, context.text)) &&
            !(
                declaration.kind === "typeParameter" &&
                declaration.node.type === "TSMappedType"
            );

        /**
         * Declarations without reads, each `var` redeclaration taking over the
         * reads after it, like Biome.
         */
        const unused = (binding: Binding): Declaration[] => {
            const { declarations } = binding;
            if (
                !declarations.every(({ kind }) => kind === "var") ||
                declarations.length < 2
            )
                return used(binding) ? [] : declarations.slice(0, 1);
            return declarations.filter((declaration, index) => {
                const next = declarations[index + 1];
                return !binding.references.some(
                    (reference) =>
                        reference.read &&
                        (index === 0 || reference.start >= declaration.start) &&
                        (!next || reference.start < next.start),
                );
            });
        };

        return {
            "Program:exit"() {
                for (const binding of context.semantic.bindings) {
                    const [declaration] = binding.declarations;
                    if (
                        !declaration ||
                        binding.name.startsWith("_") ||
                        binding.exported ||
                        !binding.declarations.every(reportable) ||
                        ignored(binding.name, declaration.kind)
                    )
                        continue;

                    for (const declaration of unused(binding)) {
                        const label = labels[declaration.kind] ?? "variable";
                        context.report(
                            declaration,
                            `This ${label} ${binding.name} is unused.`,
                        );
                    }
                }
            },
        };
    },
});
