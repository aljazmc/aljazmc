import { rule } from "../../rules.js";

const replacements: Record<string, string> = {
    className: "class",
    htmlFor: "for",
};

export default rule({
    name: "noReactSpecificProps",
    group: "suspicious",
    severity: "warn",
    recommended: false,
    fix: "safe",
    languages: ["jsx"],
    domains: { solid: "recommended", qwik: "recommended" },
    create: (context) => ({
        JSXAttribute(node) {
            const replacement = replacements[node.name];
            if (replacement === undefined) return;
            const name = {
                start: node.start,
                end: node.start + node.name.length,
            };
            context.report(name, "This JSX attribute is specific to React.", {
                message: `Replace this attribute name with "${replacement}"`,
                edits: [{ ...name, text: replacement }],
            });
        },
    }),
});
