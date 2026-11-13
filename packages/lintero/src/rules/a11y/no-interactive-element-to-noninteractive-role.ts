import {
    attribute,
    explicitRole,
    interactiveElement,
    nonInteractiveRoles,
} from "../../analysis/aria.js";
import Html, { AriaRoles } from "../../analysis/html.js";
import { fromRoles, isNonInteractive } from "../../analysis/roles.js";
import table from "../../analysis/table.js";
import { rule } from "../../rules.js";

/** Roles that are fine on some interactive elements, like an image drawn on a canvas. */
const exceptions: Record<string, string[]> = table({
    canvas: ["img"],
    hr: ["none", "presentation"],
});

export default rule({
    name: "noInteractiveElementToNoninteractiveRole",
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
        HtmlElement(node) {
            const role = Html.value(Html.attribute(node, "role"));
            if (role === undefined) return;
            const tag = node.tag;
            if (tag === "hr" && (role === "presentation" || role === "none"))
                return;
            const explicit = fromRoles(role);
            if (
                AriaRoles.isNotInteractiveElement(Html.aria(node)) ||
                explicit === undefined ||
                !isNonInteractive(explicit)
            )
                return;
            if (tag === "div" || tag === "span" || tag === "source") return;
            if ((tag === "svg" || tag === "canvas") && role === "img") return;
            if (tag === "a" && !Html.has(node, "href")) return;
            context.report(
                Html.opening(node),
                "Interactive elements should not be assigned non-interactive roles.",
                {
                    message: "Remove the role attribute.",
                    edits: (() => {
                        const found = Html.attribute(node, "role");
                        return found
                            ? [{ start: found.start, end: found.end, text: "" }]
                            : [];
                    })(),
                },
            );
        },
    }),
});
