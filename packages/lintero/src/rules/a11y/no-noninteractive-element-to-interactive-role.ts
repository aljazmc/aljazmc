import {
    attribute,
    explicitRole,
    interactiveRoles,
    nonInteractiveElement,
} from "../../analysis/aria.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noNoninteractiveElementToInteractiveRole",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "unsafe",
    languages: ["jsx"],
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
    }),
});
