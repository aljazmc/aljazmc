import type { NodeOf } from "@aljazmc/syntax";
import Html from "../../analysis/html.js";
import Jsx from "../../analysis/jsx.js";
import { rule } from "../../rules.js";

const focusable = new Set([
    "a",
    "button",
    "details",
    "embed",
    "iframe",
    "input",
    "select",
    "summary",
    "textarea",
]);

/** The tab index of an element, when set to a number. */
const tabIndex = (element: NodeOf<"JSXElement">): number | undefined => {
    const attribute = Jsx.attribute(element, "tabIndex");
    const value = attribute && Jsx.value(attribute);
    const number = Number(value);
    return value !== undefined &&
        !Jsx.dynamic(value) &&
        Number.isInteger(number)
        ? number
        : undefined;
};

export default rule({
    name: "noAriaHiddenOnFocusable",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "unsafe",
    languages: ["html", "jsx"],
    create: (context) => ({
        JSXElement(node) {
            if (!Jsx.intrinsic(node)) return;
            const hidden = Jsx.attribute(node, "aria-hidden");
            if (!hidden || !Jsx.truthy(node, "aria-hidden")) return;

            const index = tabIndex(node);
            const type = Jsx.attribute(node, "type");
            const hiddenInput =
                node.name === "input" &&
                type !== undefined &&
                Jsx.value(type) === "hidden";
            const reachable =
                index !== undefined
                    ? index >= 0
                    : focusable.has(node.name ?? "") && !hiddenInput;
            if (reachable)
                context.report(
                    Jsx.opening(node, context),
                    'Incorrect use of aria-hidden="true" detected.',
                    {
                        message: "Remove the aria-hidden attribute.",
                        edits: [
                            { start: hidden.start, end: hidden.end, text: "" },
                        ],
                    },
                );
        },
        HtmlElement(node) {
            const hidden = Html.truthyAriaHidden(node);
            if (!hidden) return;
            const report = () =>
                context.report(
                    Html.opening(node),
                    'Incorrect use of aria-hidden="true" detected.',
                    {
                        message:
                            "Remove the aria-hidden attribute from the element.",
                        edits: [
                            { start: hidden.start, end: hidden.end, text: "" },
                        ],
                    },
                );
            const tabindex = Html.value(
                Html.attribute(node, "tabindex"),
            )?.trim();
            if (tabindex !== undefined && /^[+-]?\d+$/.test(tabindex)) {
                if (Number(tabindex) >= 0) report();
                return;
            }
            const tag = node.tag;
            if ((tag === "a" || tag === "area") && Html.has(node, "href"))
                return report();
            if (
                ["button", "select", "textarea", "details", "summary"].includes(
                    tag ?? "",
                )
            )
                return report();
            if (tag === "input") {
                const type = Html.value(Html.attribute(node, "type"))?.trim();
                if (type?.toLowerCase() !== "hidden") report();
                return;
            }
            const editable = Html.attribute(node, "contenteditable");
            if (!editable) return;
            const value = Html.value(editable)?.trim().toLowerCase();
            if (
                value === undefined ||
                value === "" ||
                value === "true" ||
                value === "plaintext-only"
            )
                report();
        },
    }),
});
