import { rule } from "../../rules.js";

export default rule({
    name: "noJsxNamespace",
    group: "correctness",
    severity: "error",
    recommended: false,
    fix: "none",
    languages: ["jsx"],
    domains: { react: "recommended" },
    create: (context) => ({
        JSXElement(node) {
            const name = node.name ?? "";
            if (!name.includes(":")) return;
            const start = context.skip(node.start + 1);
            context.report(
                { start, end: start + name.length },
                "Unexpected JSX namespace syntax.",
            );
        },
    }),
});
