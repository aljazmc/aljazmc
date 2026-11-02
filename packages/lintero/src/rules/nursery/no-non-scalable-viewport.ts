import Html from "../../analysis/html.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noNonScalableViewport",
    group: "nursery",
    severity: "error",
    recommended: false,
    fix: "none",
    languages: ["html"],
    create: (context) => ({
        HtmlElement(node) {
            if (node.tag !== "meta") return;
            const name = Html.value(Html.attribute(node, "name"));
            const content = Html.attribute(node, "content");
            const value = Html.value(content);
            if (!content || name === undefined || value === undefined) return;
            if (name.toLowerCase() !== "viewport") return;
            const disabled = value.split(",").some((directive) => {
                const equals = directive.indexOf("=");
                if (equals < 0) return false;
                return (
                    directive.slice(0, equals).trim().toLowerCase() ===
                        "user-scalable" &&
                    directive
                        .slice(equals + 1)
                        .trim()
                        .toLowerCase() === "no"
                );
            });
            if (disabled)
                context.report(content, "The viewport disables user scaling.");
        },
    }),
});
