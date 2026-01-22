import { rule } from "../../rules.js";

export default rule({
    name: "noEmptyInterface",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "safe",
    languages: ["ts"],
    create: (context) => ({
        TSInterfaceDeclaration(node) {
            if (node.body.body.length > 0 || node.extends.length > 0) return;
            // interfaces in ambient modules may augment others
            for (const ancestor of context.ancestors(node))
                if (ancestor.type === "TSModuleDeclaration" && ancestor.declare)
                    return;
            context.report(node, "An empty interface is equivalent to {}.", {
                message: "Use a type alias instead.",
                edits: [
                    {
                        start: node.start,
                        end: node.end,
                        text: `type ${context.slice(node.id)}${node.typeParameters ? context.slice(node.typeParameters) : ""} = {}`,
                    },
                ],
            });
        },
    }),
});
