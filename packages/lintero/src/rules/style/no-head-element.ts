import Imports from "../../analysis/imports.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noHeadElement",
    group: "style",
    severity: "warn",
    recommended: false,
    fix: "none",
    languages: ["jsx"],
    domains: { next: "recommended" },
    create: (context) => ({
        JSXElement(node) {
            // the app directory handles <head> itself
            if (
                node.name === "head" &&
                !node.selfClosing &&
                !Imports.segments(context.file).slice(0, -1).includes("app")
            ) {
                // like Biome, a parenthesized element starts after its parenthesis
                const outer = context.outer(node);
                const start =
                    outer.start === node.start ? node.start : outer.start + 1;
                context.report(
                    { start, end: node.end },
                    "Don't use <head> element.",
                );
            }
        },
    }),
});
