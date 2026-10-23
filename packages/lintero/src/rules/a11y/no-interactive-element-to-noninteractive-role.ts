import {
    attribute,
    explicitRole,
    interactiveElement,
    nonInteractiveRoles,
} from "../../analysis/aria.js";
import { rule } from "../../rules.js";

/** Roles that are fine on some interactive elements, like an image drawn on a canvas. */
const exceptions: Record<string, string[]> = {
    canvas: ["img"],
    hr: ["none", "presentation"],
};

export default rule({
    name: "noInteractiveElementToNoninteractiveRole",
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
                !interactiveElement(node) ||
                !nonInteractiveRoles.has(role) ||
                exceptions[node.name ?? ""]?.includes(role)
            )
                return;
            const found = attribute(node, "role");
            context.report(
                node,
                "Interactive elements should not be assigned non-interactive roles.",
                found && {
                    message: "Remove the role attribute.",
                    edits: [{ start: found.start, end: found.end, text: "" }],
                },
            );
        },
    }),
});
