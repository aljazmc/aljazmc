import Jsx from "../../analysis/jsx.js";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

const message = "Unexpected style attribute.";

export default rule({
    name: "noInlineStyles",
    group: "style",
    severity: "info",
    recommended: false,
    fix: "unsafe",
    languages: ["html", "jsx"],
    create: (context) => ({
        JSXElement(node) {
            // like Biome, HTML elements, not components or namespaced ones
            if (!Jsx.intrinsic(node) || node.name?.includes(":")) return;
            for (const attribute of node.attributes)
                if (
                    attribute.type === "JSXAttribute" &&
                    attribute.name.toLowerCase() === "style"
                )
                    context.report(attribute, message, {
                        message: "Remove the style attribute.",
                        edits: [
                            {
                                start: attribute.start,
                                end: attribute.end,
                                text: "",
                            },
                        ],
                    });
        },
        CallExpression(node) {
            // `React.createElement("div", { style: {} })`, any element by its name
            const [element, props] = node.arguments;
            if (
                Nodes.path(node.callee) !== "React.createElement" ||
                !element ||
                Nodes.string(element) === undefined ||
                props?.type !== "ObjectExpression"
            )
                return;
            for (const property of props.properties)
                if (
                    property.type === "Property" &&
                    !property.computed &&
                    !property.shorthand &&
                    property.key.type === "Identifier" &&
                    property.key.name.toLowerCase() === "style"
                )
                    context.report(property, message);
        },
        HtmlElement(node) {
            const style = node.attributes.find(
                (attribute) => attribute.name.toLowerCase() === "style",
            );
            if (style)
                context.report(style, message, {
                    message: "Remove the style attribute.",
                    edits: [{ start: style.start, end: style.end, text: "" }],
                });
        },
    }),
});
