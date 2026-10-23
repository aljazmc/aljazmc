import { properties } from "../../analysis/aria.js";
import { rule } from "../../rules.js";

const unsupported = ["meta", "html", "script", "style"];

export default rule({
    name: "noAriaUnsupportedElements",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "unsafe",
    languages: ["jsx"],
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
    }),
});
