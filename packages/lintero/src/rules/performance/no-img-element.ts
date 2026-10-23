import { rule } from "../../rules.js";

export default rule({
    name: "noImgElement",
    group: "performance",
    severity: "warn",
    recommended: false,
    fix: "none",
    languages: ["jsx"],
    domains: { next: "recommended" },
    create: (context) => ({
        JSXElement(node) {
            if (node.name !== "img" || node.attributes.length === 0) return;
            // images with sources in a <picture> are fine
            const parent = context.parent(node);
            if (parent?.type === "JSXElement" && parent.name === "picture")
                return;
            context.report(node, "Don't use <img> element.");
        },
    }),
});
