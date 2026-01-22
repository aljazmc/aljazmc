import { rule } from "../../rules.js";

export default rule({
    name: "noDistractingElements",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "unsafe",
    languages: ["jsx"],
    create: (context) => ({
        JSXElement(node) {
            if (node.name === "marquee" || node.name === "blink")
                context.report(node, `Don't use the '${node.name}' element.`);
        },
    }),
});
