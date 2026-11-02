import Html from "../../analysis/html.js";
import Jsx from "../../analysis/jsx.js";
import { rule } from "../../rules.js";

export default rule({
    name: "useIframeTitle",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["html", "jsx"],
    create: (context) => ({
        JSXElement(node) {
            if (node.name !== "iframe" || Jsx.spreads(node)) return;
            const title = Jsx.attribute(node, "title");
            const value = title ? Jsx.value(title) : undefined;
            if (
                Jsx.dynamic(value) ||
                (typeof value === "string" && value.trim() !== "")
            )
                return;
            context.report(
                node,
                "Provide a title attribute when using iframe elements.",
            );
        },
        HtmlElement(node) {
            if (node.tag !== "iframe" || Html.nonEmpty(node, "title")) return;
            context.report(
                Html.opening(node),
                "Provide a title attribute when using iframe elements.",
            );
        },
    }),
});
