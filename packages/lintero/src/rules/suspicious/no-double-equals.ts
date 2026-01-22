import { rule } from "../../rules.js";

export default rule<{ ignoreNull?: boolean }>({
    name: "noDoubleEquals",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    options: { ignoreNull: true },
    create: (context) => ({
        BinaryExpression(node) {
            if (node.operator !== "==" && node.operator !== "!=") return;
            if (
                context.options.ignoreNull &&
                (node.left.type === "NullLiteral" ||
                    node.right.type === "NullLiteral")
            )
                return;

            const operator = context.token(node.left.end, node.right.start);
            context.report(
                operator,
                `Using ${node.operator} may be unsafe if you are relying on type coercion.`,
                {
                    message: `Use ${node.operator}= instead.`,
                    edits: [{ ...operator, text: `${node.operator}=` }],
                },
            );
        },
    }),
});
