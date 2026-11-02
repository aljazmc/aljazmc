import type { Node } from "@aljazmc/syntax";
import Html from "../../analysis/html.js";
import Jsx, { type Value } from "../../analysis/jsx.js";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

const positive = (value: Value) => {
    const number = typeof value === "string" ? Number(value) : value;
    return typeof number === "number" && number > 0;
};
const message = "Avoid positive values for the tabIndex prop.";

export default rule({
    name: "noPositiveTabindex",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "unsafe",
    languages: ["html", "js", "jsx"],
    create: (context) => ({
        JSXElement(node) {
            if (!Jsx.intrinsic(node)) return;
            const attribute = Jsx.attribute(node, "tabIndex");
            if (attribute?.value && positive(Jsx.value(attribute)))
                context.report(attribute.value, message);
        },
        CallExpression(node) {
            const path = Nodes.path(node.callee);
            const [type, props] = node.arguments;
            if (
                (path !== "React.createElement" && path !== "createElement") ||
                !type ||
                Nodes.string(type) === undefined ||
                props?.type !== "ObjectExpression"
            )
                return;
            for (const property of props.properties)
                if (
                    property.type === "Property" &&
                    Nodes.key(property.key, property.computed) === "tabIndex" &&
                    positive(Jsx.expression(property.value))
                )
                    context.report(property.value as Node, message);
        },
        HtmlElement(node) {
            const tabindex = Html.attribute(node, "tabindex");
            const value = Html.value(tabindex)?.trim();
            if (!tabindex?.value || value === undefined) return;
            if (!/^[+-]?\d+$/.test(value) || Number(value) <= 0) return;
            context.report(
                tabindex.value,
                "Avoid positive values for the tabindex attribute.",
                {
                    message: 'Replace the tabindex value with "0".',
                    edits: [
                        {
                            start: tabindex.value.start,
                            end: tabindex.value.end,
                            text: '"0"',
                        },
                    ],
                },
            );
        },
    }),
});
