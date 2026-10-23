import { rule } from "../../rules.js";

export default rule({
    name: "useQwikValidLexicalScope",
    group: "correctness",
    severity: "error",
    recommended: false,
    fix: "none",
    languages: ["js"],
    domains: { qwik: "recommended" },
    create: (context) => ({
        VariableDeclarator(node) {
            const declaration = context.parent(node);
            const exported =
                declaration &&
                context.parent(declaration)?.type === "ExportNamedDeclaration";
            if (node.init?.type === "ArrowFunctionExpression" && !exported)
                context.report(
                    node.init,
                    "Non-serializable expression must be wrapped with $(...)",
                );
        },
    }),
});
