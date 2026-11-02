import { rule } from "../../rules.js";

export default rule({
    name: "noDistractingElements",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "unsafe",
    languages: ["html", "jsx"],
    create: (context) => ({
        JSXElement(node) {
            if (node.name === "marquee" || node.name === "blink")
                context.report(node, `Don't use the '${node.name}' element.`);
        },
        HtmlElement(node) {
            if (node.tag !== "marquee" && node.tag !== "blink") return;
            context.report(node, `Don't use the '${node.name}' element.`, {
                message: `Remove the '${node.name}' element.`,
                edits: [{ start: node.start, end: node.end, text: "" }],
            });
        },
    }),
});
