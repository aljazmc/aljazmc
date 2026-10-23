import React from "../../analysis/react.js";
import { rule } from "../../rules.js";

const message =
    "Avoid passing both children and the dangerouslySetInnerHTML prop.";

export default rule({
    name: "noDangerouslySetInnerHtmlWithChildren",
    group: "security",
    severity: "error",
    recommended: false,
    fix: "none",
    languages: ["js", "jsx"],
    domains: { react: "recommended" },
    create: (context) => ({
        JSXElement(node) {
            const named = (name: string) =>
                node.attributes.find(
                    (attribute) =>
                        attribute.type === "JSXAttribute" &&
                        attribute.name === name,
                );
            const dangerous = named("dangerouslySetInnerHTML");
            if (dangerous && (node.children.length > 0 || named("children")))
                context.report(dangerous, message);
        },
        CallExpression(node) {
            const props = React.props(context, node);
            const dangerous =
                props &&
                React.property(props, "dangerouslySetInnerHTML", false);
            if (
                props &&
                dangerous &&
                (node.arguments.length > 2 ||
                    React.property(props, "children", false))
            )
                context.report(dangerous.key, message);
        },
    }),
});
