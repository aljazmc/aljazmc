import type { NodeOf } from "@aljazmc/syntax";
import Jsx from "../../analysis/jsx.js";
import { rule } from "../../rules.js";

const interactive = new Set([
    "button",
    "details",
    "embed",
    "iframe",
    "input",
    "label",
    "menuitem",
    "option",
    "select",
    "summary",
    "textarea",
]);

/** Elements keyboards already reach and operate. */
const operable = (element: NodeOf<"JSXElement">): boolean =>
    interactive.has(element.name ?? "") ||
    ((element.name === "a" || element.name === "area") &&
        Jsx.attribute(element, "href") !== undefined);

export default rule({
    name: "useKeyWithClickEvents",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["jsx"],
    create: (context) => ({
        JSXElement(node) {
            if (!Jsx.intrinsic(node) || !Jsx.attribute(node, "onClick")) return;
            if (operable(node) || Jsx.truthy(node, "aria-hidden")) return;
            const role = Jsx.attribute(node, "role");
            const roleValue = role && Jsx.value(role);
            if (roleValue === "presentation" || roleValue === "none") return;
            if (
                ["onKeyUp", "onKeyDown", "onKeyPress"].some(
                    (name) => Jsx.attribute(node, name) !== undefined,
                )
            )
                return;
            context.report(
                Jsx.opening(node, context),
                "Enforce to have the onClick mouse event with the onKeyUp, the onKeyDown, or the onKeyPress keyboard event.",
            );
        },
    }),
});
