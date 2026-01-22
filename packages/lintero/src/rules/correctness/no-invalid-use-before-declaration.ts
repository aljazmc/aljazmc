import type { Node } from "@aljazmc/syntax";
import type Context from "../../analysis/context.js";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

const kinds: Record<string, string> = {
    const: "variable",
    let: "variable",
    using: "variable",
    var: "variable",
    parameter: "parameter",
    class: "class",
    enum: "enum",
};

/** The function, or class member, a node runs in, references in another one run later. */
const runner = (context: Context, node: Node): Node | undefined => {
    for (const ancestor of context.ancestors(node))
        if (
            Nodes.isFunction(ancestor) ||
            ancestor.type === "PropertyDefinition" ||
            ancestor.type === "StaticBlock" ||
            ancestor.type === "TSModuleDeclaration"
        )
            return ancestor;
};

export default rule({
    name: "noInvalidUseBeforeDeclaration",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        "Program:exit"() {
            for (const binding of context.semantic.bindings) {
                const [declaration] = binding.declarations;
                const kind = declaration && kinds[declaration.kind];
                if (!declaration || !kind || declaration.ambient) continue;
                const home =
                    declaration.kind === "parameter"
                        ? declaration.node
                        : runner(context, declaration.id);

                for (const reference of binding.references) {
                    if (reference.type || reference.start >= declaration.start)
                        continue;
                    const parent = context.parent(reference.node);
                    if (parent?.type === "ExportSpecifier") continue;
                    // `typeof x` types only exist when type checking
                    if (
                        [...context.ancestors(reference.node)].some(
                            (ancestor) => ancestor.type === "TSTypeQuery",
                        )
                    )
                        continue;
                    const where = runner(context, reference.node);
                    if (
                        declaration.kind === "parameter"
                            ? where !== home && where !== undefined
                            : where !== home
                    )
                        continue;
                    context.report(
                        reference,
                        `This ${kind} is used before its declaration.`,
                    );
                }
            }
        },
    }),
});
