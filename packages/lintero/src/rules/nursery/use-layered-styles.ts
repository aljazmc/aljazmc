import { rule } from "../../rules.js";

export default rule<{ requireImportLayers?: boolean }>({
    name: "useLayeredStyles",
    group: "nursery",
    severity: "warn",
    recommended: false,
    fix: "none",
    languages: ["css"],
    options: { requireImportLayers: true },
    create: (context) => ({
        CssRule(node) {
            if (!node.selectors) return;
            for (const ancestor of context.cssAncestors(node))
                if (
                    ancestor.type === "Rule" ||
                    (ancestor.type === "AtRule" && ancestor.keyword === "layer")
                )
                    return;
            context.report(
                node,
                "This style rule is defined outside of a cascade layer.",
            );
        },
        CssAtRule(node) {
            if (
                node.keyword !== "import" ||
                !context.options.requireImportLayers
            )
                return;
            const layered = node.prelude.some(
                (value) =>
                    (value.type === "Identifier" &&
                        /^layer$/i.test(value.value)) ||
                    (value.type === "Function" && /^layer$/i.test(value.name)),
            );
            if (!layered)
                context.report(
                    { start: node.start + 1, end: node.end },
                    "This import is defined outside of a cascade layer.",
                );
        },
    }),
});
