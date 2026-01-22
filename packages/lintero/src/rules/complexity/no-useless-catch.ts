import { rule } from "../../rules.js";

export default rule({
    name: "noUselessCatch",
    group: "complexity",
    severity: "info",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    create: (context) => ({
        CatchClause(node) {
            const [statement] = node.body.body;
            if (
                node.param?.type !== "Identifier" ||
                node.body.body.length !== 1 ||
                statement?.type !== "ThrowStatement" ||
                statement.argument.type !== "Identifier" ||
                statement.argument.name !== node.param.name
            )
                return;
            context.report(
                statement,
                "The catch clause that only rethrows the original error is useless.",
            );
        },
    }),
});
