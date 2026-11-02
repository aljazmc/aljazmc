import {
    properties as ariaProperties,
    properties,
} from "../../analysis/aria.js";
import Html from "../../analysis/html.js";
import { rule } from "../../rules.js";

const unsupported = ["meta", "html", "script", "style"];

export default rule({
    name: "noAriaUnsupportedElements",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "unsafe",
    languages: ["html", "jsx"],
    create: (context) => ({
        JSXElement(node) {
            if (!unsupported.includes(node.name ?? "")) return;
            const found = node.attributes.find(
                (attribute) =>
                    attribute.type === "JSXAttribute" &&
                    (attribute.name === "role" ||
                        (attribute.name.startsWith("aria-") &&
                            Object.hasOwn(
                                properties,
                                attribute.name.slice(5),
                            ))),
            );
            if (found)
                context.report(
                    node,
                    "Avoid the role attribute and aria-* attributes when using meta, html, script, and style elements.",
                    {
                        message: "Remove the attribute.",
                        edits: [
                            { start: found.start, end: found.end, text: "" },
                        ],
                    },
                );
        },
        HtmlElement(node) {
            if (!["meta", "html", "script", "style"].includes(node.tag ?? ""))
                return;
            const found = node.attributes.find((attribute) => {
                const name = attribute.name.toLowerCase();
                return (
                    (name.startsWith("aria-") &&
                        ariaProperties[name.slice(5)] !== undefined) ||
                    name === "role"
                );
            });
            if (!found) return;
            context.report(
                Html.opening(node),
                "Avoid the role attribute and aria-* attributes when using meta, html, script, and style elements.",
                {
                    message: `Remove the ${found.name} attribute.`,
                    edits: [{ start: found.start, end: found.end, text: "" }],
                },
            );
        },
    }),
});
