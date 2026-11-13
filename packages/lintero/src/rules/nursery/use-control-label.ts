import type { Html as Tree } from "@aljazmc/syntax";
import Html from "../../analysis/html.js";
import { rule } from "../../rules.js";

const labelled = (node: Tree.Element) =>
    ["aria-label", "aria-labelledby", "title"].some((name) =>
        Html.nonEmpty(node, name),
    );

/** Whether children have content screen readers read, for controls. */
const accessible = (children: Tree.Child[]): boolean =>
    children.some((child) => {
        if (child.type === "Text") return child.value.trim() !== "";
        if (child.type === "Cdata") return true;
        if (child.closing !== null) {
            if (Html.truthyAriaHidden(child)) return false;
            return labelled(child) || accessible(child.children);
        }
        if (Html.truthyAriaHidden(child)) return false;
        if (
            Html.nonEmpty(child, "aria-label") ||
            Html.nonEmpty(child, "aria-labelledby") ||
            Html.nonEmpty(child, "title")
        )
            return true;
        if (child.tag === "img") return Html.nonEmpty(child, "alt");
        if (child.tag === "input")
            return (
                Html.value(Html.attribute(child, "type"))?.toLowerCase() !==
                "hidden"
            );
        return false;
    });

export default rule({
    name: "useControlLabel",
    group: "nursery",
    severity: "error",
    recommended: false,
    fix: "none",
    languages: ["html"],
    create: (context) => ({
        HtmlElement(node) {
            if (node.tag !== "button" && node.tag !== "menuitem") return;
            if (Html.truthyAriaHidden(node) || labelled(node)) return;
            if (node.closing !== null && accessible(node.children)) return;
            context.report(
                node,
                "This control element has no accessible label.",
            );
        },
    }),
});
