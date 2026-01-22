import type { Node } from "@aljazmc/syntax";
import type Context from "../../analysis/context.js";
import Nodes from "../../analysis/nodes.js";
import type { Edit } from "../../rules.js";
import { rule } from "../../rules.js";

/** The closest function that has its own `this`, or the program. */
const thisScope = (context: Context, node: Node): Node | undefined => {
    for (const ancestor of context.ancestors(node))
        if (
            (Nodes.isFunction(ancestor) &&
                ancestor.type !== "ArrowFunctionExpression") ||
            ancestor.type === "Program" ||
            ancestor.type === "StaticBlock" ||
            ancestor.type === "PropertyDefinition"
        )
            return ancestor;
};

export default rule({
    name: "noUselessThisAlias",
    group: "complexity",
    severity: "info",
    recommended: true,
    fix: "safe",
    languages: ["js"],
    create: (context) => ({
        VariableDeclarator(node) {
            if (
                node.id.type !== "Identifier" ||
                node.init?.type !== "ThisExpression"
            )
                return;
            const binding = context.semantic.declared(node.id);
            if (!binding || binding.exported || binding.declarations.length > 1)
                return;

            const scope = thisScope(context, node);
            if (
                binding.references.some(
                    (reference) =>
                        reference.write ||
                        thisScope(context, reference.node) !== scope,
                )
            )
                return;

            const declaration = context.parent(node);
            const edits: Edit[] = binding.references.map((reference) => ({
                start: reference.start,
                end: reference.end,
                text: "this",
            }));
            context.report(
                node,
                "This aliasing of this is unnecessary.",
                declaration?.type === "VariableDeclaration" &&
                    declaration.declarations.length === 1
                    ? {
                          message: "Use this instead of an alias.",
                          edits: [
                              {
                                  start: declaration.start,
                                  end: declaration.end,
                                  text: "",
                              },
                              ...edits,
                          ],
                      }
                    : undefined,
            );
        },
    }),
});
