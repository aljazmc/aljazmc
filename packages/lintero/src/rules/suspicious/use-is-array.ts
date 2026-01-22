import { rule } from "../../rules.js";

export default rule({
    name: "useIsArray",
    group: "suspicious",
    severity: "warn",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    create: (context) => ({
        BinaryExpression(node) {
            if (
                node.operator !== "instanceof" ||
                node.right.type !== "Identifier" ||
                node.right.name !== "Array" ||
                !context.semantic.isGlobal(node.right)
            )
                return;
            context.report(
                node,
                "Use Array.isArray() instead of instanceof Array.",
                {
                    message: "Use Array.isArray() instead.",
                    edits: [
                        {
                            start: node.start,
                            end: node.end,
                            text: `Array.isArray(${context.slice(node.left)})`,
                        },
                    ],
                },
            );
        },
    }),
});
