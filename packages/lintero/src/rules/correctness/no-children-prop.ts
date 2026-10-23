import React from "../../analysis/react.js";
import { rule } from "../../rules.js";

const message = "Avoid passing children using a prop";

export default rule({
    name: "noChildrenProp",
    group: "correctness",
    severity: "error",
    recommended: false,
    fix: "none",
    languages: ["js", "jsx"],
    domains: { react: "recommended" },
    create: (context) => ({
        JSXElement(node) {
            const children = node.attributes.find(
                (attribute) =>
                    attribute.type === "JSXAttribute" &&
                    attribute.name === "children",
            );
            if (children) context.report(children, message);
        },
        CallExpression(node) {
            const props = React.props(context, node);
            const children = props && React.property(props, "children");
            if (children)
                context.report(
                    { start: children.start, end: children.key.end },
                    message,
                );
        },
    }),
});
