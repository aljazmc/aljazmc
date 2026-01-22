import { rule } from "../../rules.js";

export default rule({
    name: "noGlobalEval",
    group: "security",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        Identifier(node) {
            if (node.name !== "eval" || !context.semantic.isGlobal(node))
                return;
            const parent = context.parent(node);
            if (parent?.type === "MemberExpression" && parent.property === node)
                return;
            context.report(node, "Do not use eval().");
        },
        MemberExpression(node) {
            const { object, property } = node;
            if (
                object.type === "Identifier" &&
                ["globalThis", "window", "global"].includes(object.name) &&
                context.semantic.isGlobal(object) &&
                !node.computed &&
                property.type === "Identifier" &&
                property.name === "eval"
            )
                context.report(node, "Do not use eval().");
        },
    }),
});
