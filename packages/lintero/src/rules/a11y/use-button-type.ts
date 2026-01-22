import type { Node } from "@aljazmc/syntax";
import Jsx from "../../analysis/jsx.js";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

const types = ["button", "reset", "submit"];

export default rule({
    name: "useButtonType",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js", "jsx"],
    create: (context) => ({
        JSXElement(node) {
            if (node.name !== "button") return;
            const type = Jsx.attribute(node, "type");
            if (!type) {
                if (!Jsx.spreads(node))
                    context.report(
                        node,
                        "Provide an explicit type prop for the button element.",
                    );
                return;
            }
            const value = Jsx.value(type);
            if (!Jsx.dynamic(value) && !types.includes(String(value)))
                context.report(
                    type.value ?? type,
                    "Provide a valid type prop for the button element.",
                );
        },
        CallExpression(node) {
            const path = Nodes.path(node.callee);
            const [element, props] = node.arguments;
            if (
                (path !== "React.createElement" && path !== "createElement") ||
                !element ||
                Nodes.string(element) !== "button"
            )
                return;
            if (props?.type !== "ObjectExpression") {
                if (!props)
                    context.report(
                        element,
                        "Provide an explicit type prop for the button element.",
                    );
                return;
            }
            const type = props.properties.find(
                (property): property is Node & { type: "Property" } =>
                    property.type === "Property" &&
                    Nodes.key(property.key, property.computed) === "type",
            );
            if (!type) {
                if (
                    !props.properties.some(
                        (property) => property.type === "SpreadElement",
                    )
                )
                    context.report(
                        props,
                        "Provide an explicit type prop for the button element.",
                    );
                return;
            }
            const value = Jsx.expression(type.value);
            if (!Jsx.dynamic(value) && !types.includes(String(value)))
                context.report(
                    type.value,
                    "Provide a valid type prop for the button element.",
                );
        },
    }),
});
