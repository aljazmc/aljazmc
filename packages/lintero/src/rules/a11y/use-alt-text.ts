import type { NodeOf } from "@aljazmc/syntax";
import Html from "../../analysis/html.js";
import Jsx from "../../analysis/jsx.js";
import { rule } from "../../rules.js";

/** Whether an attribute is present with a value that may be meaningful. */
const has = (node: NodeOf<"JSXElement">, name: string) => {
    const attribute = Jsx.attribute(node, name);
    if (!attribute) return false;
    const value = Jsx.value(attribute);
    return value !== undefined && value !== null && value !== false;
};

export default rule({
    name: "useAltText",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["html", "jsx"],
    create: (context) => ({
        JSXElement(node) {
            if (Jsx.spreads(node)) return;
            const labelled =
                has(node, "aria-label") || has(node, "aria-labelledby");
            const alt = Jsx.attribute(node, "alt");
            const altValue = alt ? Jsx.value(alt) : undefined;
            const hasAlt =
                alt !== undefined &&
                altValue !== undefined &&
                altValue !== null;
            let missing = false;
            switch (node.name) {
                case "img":
                case "area":
                    missing = !hasAlt && !labelled;
                    break;
                case "input": {
                    const type = Jsx.attribute(node, "type");
                    missing =
                        type !== undefined &&
                        Jsx.value(type) === "image" &&
                        !hasAlt &&
                        !labelled;
                    break;
                }
                case "object":
                    missing =
                        !labelled &&
                        !has(node, "title") &&
                        node.children.length === 0;
                    break;
            }
            if (missing)
                context.report(
                    node,
                    "Provide a text alternative through the alt, aria-label or aria-labelledby attribute",
                );
        },
        HtmlElement(node) {
            const labelled =
                Html.nonEmpty(node, "aria-label") ||
                Html.nonEmpty(node, "aria-labelledby") ||
                Html.ariaHiddenTrue(node);
            if (labelled) return;
            const tag = node.tag;
            const alt = Html.has(node, "alt");
            if (tag === "object") {
                if (!Html.nonEmpty(node, "title"))
                    context.report(
                        Html.opening(node),
                        "Provide a text alternative through the title, aria-label, or aria-labelledby attribute.",
                    );
                return;
            }
            const image =
                tag === "img" ||
                tag === "area" ||
                (tag === "input" &&
                    Html.value(Html.attribute(node, "type"))?.toLowerCase() ===
                        "image");
            if (image && !alt)
                context.report(
                    Html.opening(node),
                    "Provide a text alternative through the alt, aria-label, or aria-labelledby attribute.",
                );
        },
    }),
});
