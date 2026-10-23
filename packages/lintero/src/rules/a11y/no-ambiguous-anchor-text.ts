import type { Node } from "@aljazmc/syntax";
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

export default rule<{ words?: string[] }>({
    name: "noAmbiguousAnchorText",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["jsx"],
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
    }),
});
