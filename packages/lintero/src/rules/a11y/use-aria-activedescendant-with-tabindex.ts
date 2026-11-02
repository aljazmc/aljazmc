import { attribute, nonInteractiveElement } from "../../analysis/aria.js";
import Html from "../../analysis/html.js";
import { rule } from "../../rules.js";

export default rule({
    name: "useAriaActivedescendantWithTabindex",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "unsafe",
    languages: ["html", "jsx"],
    create: (context) => ({
        JSXElement(node) {
            const name = node.name ?? "";
            if (
                name !== "div" &&
                name !== "span" &&
                !nonInteractiveElement(node)
            )
                return;
            const descendant = attribute(node, "aria-activedescendant");
            if (!descendant || attribute(node, "tabIndex")) return;
            context.report(
                node,
                "Enforce elements with aria-activedescendant are tabbable.",
                {
                    message: "Add the tabIndex attribute.",
                    edits: [
                        {
                            start: descendant.end,
                            end: descendant.end,
                            text: " tabIndex={0}",
                        },
                    ],
                },
            );
        },
        HtmlElement(node) {
            if (!Html.has(node, "aria-activedescendant")) return;
            if (
                ["button", "input", "select", "textarea"].includes(
                    node.tag ?? "",
                )
            )
                return;
            if (node.tag === "a" && Html.has(node, "href")) return;
            if (Html.has(node, "tabindex")) return;
            context.report(
                Html.opening(node),
                "Enforce elements with aria-activedescendant are tabbable.",
            );
        },
    }),
});
