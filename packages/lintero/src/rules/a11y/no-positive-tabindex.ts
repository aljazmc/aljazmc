import type { Node } from "@aljazmc/syntax";
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
    languages: ["js", "jsx"],
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
    }),
});
