import Html, { AriaRoles } from "../../analysis/html.js";
import Jsx from "../../analysis/jsx.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noSvgWithoutTitle",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["html", "jsx"],
    create: (context) => ({
        JSXElement(node) {
            if (node.name !== "svg" || Jsx.spreads(node)) return;
            if (Jsx.truthy(node, "aria-hidden")) return;
            const role = Jsx.attribute(node, "role");
            const roleValue = role && Jsx.value(role);
            if (Jsx.dynamic(roleValue)) return;
            if (["img", "presentation", "none"].includes(String(roleValue)))
                return;

            const titled = node.children.some(
                (child) =>
                    child.type === "JSXElement" &&
                    child.name === "title" &&
                    child.children.some(
                        (text) =>
                            text.type === "JSXText" && text.raw.trim() !== "",
                    ),
            );
            if (!titled)
                context.report(
                    Jsx.opening(node, context),
                    "Alternative text title element cannot be empty",
                );
        },
        HtmlElement(node) {
            if (node.tag !== "svg" || node.closing === null) return;
            if (Html.ariaHiddenTrue(node)) return;
            const first = node.children[0];
            if (
                first?.type === "Element" &&
                first.closing !== null &&
                first.name === "title" &&
                first.children.length > 0
            )
                return;
            if (!AriaRoles.hasNameRequiredImageRole(Html.aria(node))) return;
            if (Html.has(node, "aria-label")) return;
            const labelledby = Html.attribute(node, "aria-labelledby");
            if (labelledby?.value) {
                const id = Html.value(labelledby);
                if (
                    node.children.some(
                        (child) =>
                            child.type === "Element" &&
                            child.closing !== null &&
                            Html.attribute(child, "id")?.value &&
                            Html.value(Html.attribute(child, "id")) === id,
                    )
                )
                    return;
            }
            context.report(
                node,
                "Alternative text title element cannot be empty",
            );
        },
    }),
});
