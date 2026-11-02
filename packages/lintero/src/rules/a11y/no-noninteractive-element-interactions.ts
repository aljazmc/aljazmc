import Html, { AriaRoles } from "../../analysis/html.js";
import { isInteractive } from "../../analysis/roles.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noNoninteractiveElementInteractions",
    group: "a11y",
    severity: "info",
    recommended: false,
    fix: "none",
    languages: ["html"],
    create: (context) => ({
        HtmlElement(node) {
            const aria = Html.aria(node);
            const role = AriaRoles.roleByElementName(aria);
            if (
                !Html.handles(node, ["focus", "image", "keyboard", "mouse"]) ||
                Html.contentEditable(node) ||
                AriaRoles.isPresentationRole(aria) ||
                Html.hiddenFromScreenReader(node) ||
                (role !== undefined && isInteractive(role)) ||
                AriaRoles.implicitRole(aria) === "dialog"
            )
                return;
            if (AriaRoles.isNotInteractiveElement(aria))
                context.report(
                    Html.opening(node),
                    "Unexpected event handler on non-interactive element.",
                );
        },
    }),
});
