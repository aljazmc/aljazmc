import { rule } from "../../rules.js";

export default rule({
    name: "noExplicitAny",
    group: "suspicious",
    severity: "warn",
    recommended: true,
    fix: "none",
    languages: ["ts"],
    create: (context) => ({
        TSKeyword(node) {
            const parent = context.parent(node);
            // `T extends any` only allows any type argument
            if (
                parent?.type === "TSTypeParameter" &&
                parent.constraint === node
            )
                return;
            if (node.name === "any")
                context.report(
                    node,
                    "Unexpected any. Specify a different type.",
                );
        },
    }),
});
