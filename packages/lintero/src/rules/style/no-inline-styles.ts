import { rule } from "../../rules.js";

export default rule({
    name: "noInlineStyles",
    group: "style",
    severity: "info",
    recommended: false,
    fix: "unsafe",
    languages: ["html"],
    create: (context) => ({
        HtmlElement(node) {
            const style = node.attributes.find(
                (attribute) => attribute.name.toLowerCase() === "style",
            );
            if (style)
                context.report(style, "Unexpected style attribute.", {
                    message: "Remove the style attribute.",
                    edits: [{ start: style.start, end: style.end, text: "" }],
                });
        },
    }),
});
