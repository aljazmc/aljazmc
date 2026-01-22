import type { NodeOf } from "@aljazmc/syntax";
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
    languages: ["jsx"],
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
    }),
});
