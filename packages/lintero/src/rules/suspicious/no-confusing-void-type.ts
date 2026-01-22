import type { Node, NodeOf } from "@aljazmc/syntax";
import type Context from "../../analysis/context.js";
import { rule } from "../../rules.js";

/** Whether a type sits where `void` makes sense: a return type, a type argument or default, `this`. */
const allowed = (context: Context, type: Node): boolean => {
    const parent = context.parent(type);
    if (!parent) return false;
    switch (parent.type) {
        case "TSParenthesizedType":
            return allowed(context, parent);
        case "TSTypeParameterInstantiation":
            return true;
        case "TSTypeParameter":
            return parent.default === type;
        case "Identifier":
            return parent.name === "this";
        default:
            return "returnType" in parent && parent.returnType === type;
    }
};

/** Like Biome, `void` may be in a union with `never` or a generic type, like `Promise<void>`. */
const excuses = (type: Node): boolean =>
    (type.type === "TSKeyword" && type.name === "never") ||
    (type.type === "TSTypeReference" && type.typeArguments !== null);

export default rule({
    name: "noConfusingVoidType",
    group: "suspicious",
    severity: "warn",
    recommended: true,
    fix: "unsafe",
    languages: ["ts"],
    create: (context) => ({
        TSKeyword(node) {
            if (node.name !== "void") return;
            const fix = {
                message: "Use undefined instead.",
                edits: [
                    { start: node.start, end: node.end, text: "undefined" },
                ],
            };

            let union: NodeOf<"TSUnionType"> | undefined;
            for (const parent of context.ancestors(node)) {
                if (parent.type === "TSUnionType") union = parent;
                else if (parent.type !== "TSParenthesizedType") break;
            }

            if (union) {
                if (!union.types.some(excuses))
                    context.report(
                        node,
                        "void is confusing inside a union type.",
                        fix,
                    );
            } else if (!allowed(context, node))
                context.report(
                    node,
                    "void is confusing outside a return type or a type parameter.",
                    fix,
                );
        },
    }),
});
