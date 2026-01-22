import Jsx from "../../analysis/jsx.js";
import { rule } from "../../rules.js";
import { accessible, contentProps } from "./use-heading-content.js";

export default rule({
    name: "useAnchorContent",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["jsx"],
    create: (context) => ({
        JSXElement(node) {
            if (node.name !== "a") return;
            // anchors given to components as props, like `render={<a />}`
            if (
                [...context.ancestors(node)].some(
                    (ancestor) => ancestor.type === "JSXAttribute",
                )
            )
                return;
            const visible =
                !Jsx.truthy(node, "aria-hidden") &&
                (accessible(node.children) ||
                    contentProps(node) ||
                    Jsx.spreads(node));
            if (!visible)
                context.report(
                    node,
                    "Provide screen reader accessible content when using `a` elements.",
                );
        },
    }),
});
