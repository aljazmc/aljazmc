import React from "../../analysis/react.js";
import { rule } from "../../rules.js";

const message = "Avoid passing content using the dangerouslySetInnerHTML prop.";

export default rule({
    name: "noDangerouslySetInnerHtml",
    group: "security",
    severity: "error",
    recommended: false,
    fix: "none",
    languages: ["js", "jsx"],
    domains: { react: "recommended" },
    create: (context) => ({
        JSXElement(node) {
            const attribute = node.attributes.find(
                (attribute) =>
                    attribute.type === "JSXAttribute" &&
                    attribute.name === "dangerouslySetInnerHTML",
            );
            if (attribute) context.report(attribute, message);
        },
        CallExpression(node) {
            const props = React.props(context, node);
            const property =
                props &&
                React.property(props, "dangerouslySetInnerHTML", false);
            if (property) context.report(property.key, message);
        },
    }),
});
