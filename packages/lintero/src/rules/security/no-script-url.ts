import type { Node } from "@aljazmc/syntax";
import Html from "../../analysis/html.js";
import Jsx from "../../analysis/jsx.js";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

const script = (value: unknown) =>
    typeof value === "string" && /^\s*javascript:/i.test(value);
const message = "Avoid using javascript: URLs, as they can be a security risk.";

export default rule({
    name: "noScriptUrl",
    group: "security",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["html", "js", "jsx"],
    create: (context) => ({
        HtmlElement(node) {
            if (node.tag !== "a") return;
            const href = Html.attribute(node, "href");
            const value = Html.value(href);
            if (href && value?.trim().toLowerCase().startsWith("javascript:"))
                context.report(href, message);
        },
        JSXAttribute(node) {
            if (node.value && script(Jsx.value(node)))
                context.report(
                    {
                        start: context.find("=", node.start).start,
                        end: node.end,
                    },
                    message,
                );
        },
        CallExpression(node) {
            const path = Nodes.path(node.callee);
            const props = node.arguments[1];
            if (
                (path !== "React.createElement" && path !== "createElement") ||
                props?.type !== "ObjectExpression"
            )
                return;
            for (const property of props.properties)
                if (
                    property.type === "Property" &&
                    script(Nodes.string(property.value))
                )
                    context.report(property.value as Node, message);
        },
    }),
});
