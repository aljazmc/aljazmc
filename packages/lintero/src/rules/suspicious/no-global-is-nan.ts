import type { Node } from "@aljazmc/syntax";
import type Context from "../../analysis/context.js";
import { rule } from "../../rules.js";

/** Reports global `name`, also through globalThis or window, suggesting Number.name. */
export const globalNumberMethod = (name: string) => (context: Context) => {
    const check = (node: Node, id: Node) => {
        context.report(
            node,
            `Use Number.${name} instead of the global ${name}.`,
            {
                message: `Use Number.${name} instead.`,
                edits: [
                    {
                        start: node.start,
                        end: node.end,
                        text: `Number.${name}`,
                    },
                ],
            },
        );
        void id;
    };
    return {
        Identifier(node: Node) {
            if (node.type !== "Identifier" || node.name !== name) return;
            const parent = context.parent(node);
            if (parent?.type === "MemberExpression" && parent.property === node)
                return;
            if (context.semantic.isGlobal(node)) check(node, node);
        },
        MemberExpression(node: Node) {
            if (
                node.type !== "MemberExpression" ||
                node.object.type !== "Identifier" ||
                !["globalThis", "window"].includes(node.object.name) ||
                !context.semantic.isGlobal(node.object)
            )
                return;
            const property =
                !node.computed && node.property.type === "Identifier"
                    ? node.property.name
                    : undefined;
            if (property === name) check(node, node.property);
        },
    };
};

export default rule({
    name: "noGlobalIsNan",
    group: "suspicious",
    severity: "warn",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    create: globalNumberMethod("isNaN"),
});
