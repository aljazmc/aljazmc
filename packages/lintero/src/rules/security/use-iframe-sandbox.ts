import Html from "../../analysis/html.js";
import { rule } from "../../rules.js";

export default rule({
    name: "useIframeSandbox",
    group: "security",
    severity: "error",
    recommended: false,
    fix: "none",
    languages: ["html"],
    create: (context) => ({
        HtmlElement(node) {
            if (node.tag === "iframe" && !Html.has(node, "sandbox"))
                context.report(
                    Html.opening(node),
                    "Iframe doesn't have the sandbox attribute.",
                );
        },
    }),
});
