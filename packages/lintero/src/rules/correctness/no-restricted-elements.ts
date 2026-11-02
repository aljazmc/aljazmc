import { rule } from "../../rules.js";

export default rule<{ elements?: Record<string, string> }>({
    name: "noRestrictedElements",
    group: "correctness",
    severity: "info",
    recommended: false,
    fix: "none",
    languages: ["html"],
    options: {},
    create: (context) => ({
        HtmlElement(node) {
            const elements = Object.keys(context.options.elements ?? {});
            // an exact match first, then ignoring the case of HTML names
            const restricted =
                elements.includes(node.name) ||
                elements.some(
                    (element) =>
                        element.toLowerCase() === node.name.toLowerCase(),
                );
            if (restricted)
                context.report(
                    {
                        start: node.start + 1,
                        end: node.start + 1 + node.name.length,
                    },
                    `The ${node.name} element is restricted in this project.`,
                );
        },
    }),
});
