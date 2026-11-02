import {
    attribute,
    explicitRole,
    interactiveRoles,
    nonInteractiveElement,
} from "../../analysis/aria.js";
import Html, { AriaRoles } from "../../analysis/html.js";
import { fromRoles, isInteractive } from "../../analysis/roles.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noNoninteractiveElementToInteractiveRole",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "unsafe",
    languages: ["html", "jsx"],
    create: (context) => ({
        JSXElement(node) {
            const role = explicitRole(node);
            if (
                role === undefined ||
                !nonInteractiveElement(node) ||
                !interactiveRoles.has(role) ||
                (node.name === "li" && role === "treeitem")
            )
                return;
            const found = attribute(node, "role");
            if (found)
                context.report(
                    found,
                    `The HTML element ${node.name} is non-interactive and should not have an interactive role.`,
                    {
                        message: "Remove the role attribute.",
                        edits: [
                            { start: found.start, end: found.end, text: "" },
                        ],
                    },
                );
        },
        HtmlElement(node) {
            const attribute = Html.attribute(node, "role");
            const role = Html.value(attribute);
            if (!attribute || role === undefined) return;
            const tag = node.tag;
            if (tag === "li" && role === "treeitem") return;
            const explicit = fromRoles(role);
            if (
                !AriaRoles.isNotInteractiveElement(Html.aria(node)) ||
                explicit === undefined ||
                !isInteractive(explicit)
            )
                return;
            if (tag === "div" || tag === "span") return;
            context.report(
                attribute,
                `The HTML element ${node.name} is non-interactive and should not have an interactive role.`,
                {
                    message: "Remove the role attribute.",
                    edits: [
                        {
                            start: attribute.start,
                            end: attribute.end,
                            text: "",
                        },
                    ],
                },
            );
        },
    }),
});
