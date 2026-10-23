import type { Node } from "@aljazmc/syntax";
import {
    attribute,
    interactiveRoles,
    nonInteractiveElement,
    text,
    tokens,
} from "../../analysis/aria.js";
import Jsx from "../../analysis/jsx.js";
import { rule } from "../../rules.js";

/** The number a `tabIndex` is set to, if known. */
const tabIndex = (node: Node | null): number | undefined => {
    if (!node) return;
    if (node.type === "StringLiteral") return Number(node.raw.slice(1, -1));
    if (node.type !== "JSXExpressionContainer" || !node.expression) return;
    const value = Jsx.expression(node.expression);
    if (typeof value === "number") return value;
    if (typeof value === "string") return Number(value);
};

export default rule({
    name: "noNoninteractiveTabindex",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "unsafe",
    languages: ["jsx"],
    create: (context) => ({
        JSXElement(node) {
            const name = node.name ?? "";
            if (
                name !== "div" &&
                name !== "span" &&
                !nonInteractiveElement(node)
            )
                return;
            const index = attribute(node, "tabIndex");
            const number = index ? tabIndex(index.value) : undefined;
            if (
                !index ||
                number === undefined ||
                Number.isNaN(number) ||
                number < 0
            )
                return;
            const role = attribute(node, "role");
            if (role) {
                const value =
                    role.value?.type === "StringLiteral"
                        ? text(role)
                        : undefined;
                if (value === undefined) return;
                const [first] = tokens(value);
                if (first !== undefined && interactiveRoles.has(first)) return;
            }
            context.report(
                index,
                `The HTML element ${name} is non-interactive. Do not use tabIndex.`,
                {
                    message: "Remove the tabIndex attribute.",
                    edits: [{ start: index.start, end: index.end, text: "" }],
                },
            );
        },
    }),
});
