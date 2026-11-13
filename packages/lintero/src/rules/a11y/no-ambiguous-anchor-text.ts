import type { Node, Html as Tree } from "@aljazmc/syntax";
import Html from "../../analysis/html.js";
import Jsx from "../../analysis/jsx.js";
import { rule } from "../../rules.js";

/** The text a screen reader reads for an element: aria-label, text, and image alternatives. */
const text = (node: Node): string => {
    if (node.type === "JSXText") return node.raw;
    if (node.type !== "JSXElement" || Jsx.truthy(node, "aria-hidden"))
        return "";
    const label = Jsx.attribute(node, "aria-label");
    if (label) {
        const value = Jsx.value(label);
        if (typeof value === "string") return value;
    }
    if (node.name === "img") {
        const alt = Jsx.attribute(node, "alt");
        const value = alt && Jsx.value(alt);
        return typeof value === "string" ? value : "";
    }
    return node.children.map(text).join("");
};

/** The text of an HTML element: without punctuation, lower case, single spaces. */
const standardize = (text: string): string =>
    text
        .replace(/[,.?¿!‽¡;:]/g, "")
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word !== "")
        .join(" ");

/** The text an HTML element gives screen readers through its attributes, if any. */
const accessibleText = (node: Tree.Element): string | undefined => {
    if (Html.hiddenFromScreenReader(node)) return "";
    const label = Html.value(Html.attribute(node, "aria-label"));
    if (label !== undefined) return standardize(label);
    if (node.tag !== "img") return;
    const alt = Html.value(Html.attribute(node, "alt"));
    if (alt !== undefined) return standardize(alt);
};

/** The accessible text of an HTML element and its children. */
const accessibleChildText = (node: Tree.Element): string => {
    const own = accessibleText(node);
    if (own !== undefined) return own;
    const parts = node.children.map((child) => {
        if (child.type === "Text") return child.value;
        if (child.type !== "Element") return "";
        if (child.closing !== null) return accessibleChildText(child);
        return accessibleText(child) ?? "";
    });
    return standardize(parts.join(" "));
};

export default rule<{ words?: string[] }>({
    name: "noAmbiguousAnchorText",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["html", "jsx"],
    options: { words: ["click here", "here", "link", "a link", "learn more"] },
    create: (context) => ({
        JSXElement(node) {
            if (node.name !== "a") return;
            const normalized = text(node)
                .toLowerCase()
                .replace(/[,.?¿!‽¡;:]/g, "")
                .replace(/\s+/g, " ")
                .trim();
            if ((context.options.words ?? []).includes(normalized))
                context.report(
                    node,
                    "No ambiguous anchor descriptions allowed.",
                );
        },
        HtmlElement(node) {
            if (node.tag !== "a" || node.closing === null) return;
            if (
                (context.options.words ?? []).includes(
                    accessibleChildText(node),
                )
            )
                context.report(
                    node,
                    "No ambiguous anchor descriptions allowed.",
                );
        },
    }),
});
