import type { Node, NodeOf } from "@aljazmc/syntax";
import Jsx from "../../analysis/jsx.js";
import { rule } from "../../rules.js";

/** Whether children render something screen readers can read. */
export const accessible = (children: Node[]): boolean =>
    children.some((child) => {
        switch (child.type) {
            case "JSXText":
                return child.raw.trim() !== "";
            case "JSXExpressionContainer":
                return child.expression !== null;
            case "JSXElement":
                return !Jsx.truthy(child, "aria-hidden");
            default:
                return true;
        }
    });

/** Whether attributes give an element content, children or HTML. */
export const contentProps = (element: NodeOf<"JSXElement">): boolean =>
    Jsx.attribute(element, "children") !== undefined ||
    Jsx.attribute(element, "dangerouslySetInnerHTML") !== undefined;

export default rule({
    name: "useHeadingContent",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["jsx"],
    create: (context) => ({
        JSXElement(node) {
            if (!/^h[1-6]$/.test(node.name ?? "")) return;
            const visible =
                !Jsx.truthy(node, "aria-hidden") &&
                (accessible(node.children) ||
                    contentProps(node) ||
                    Jsx.attribute(node, "aria-label") !== undefined ||
                    Jsx.attribute(node, "aria-labelledby") !== undefined ||
                    Jsx.spreads(node));
            if (!visible)
                context.report(
                    node,
                    "Provide screen reader accessible content when using heading  elements.",
                );
        },
    }),
});
