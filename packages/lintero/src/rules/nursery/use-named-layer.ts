import { rule } from "../../rules.js";

const message = "Missing cascade layer name.";

export default rule({
    name: "useNamedLayer",
    group: "nursery",
    severity: "warn",
    recommended: false,
    fix: "none",
    languages: ["css"],
    create: (context) => ({
        CssAtRule(node) {
            if (
                node.keyword === "layer" &&
                node.block &&
                node.prelude.length === 0
            )
                context.report(
                    { start: node.start + 1, end: node.end },
                    message,
                );
            if (node.keyword !== "import") return;
            for (const value of node.prelude.slice(1))
                if (value.type === "Identifier" && /^layer$/i.test(value.value))
                    context.report(value, message);
        },
    }),
});
