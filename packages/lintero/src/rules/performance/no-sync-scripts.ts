import Html from "../../analysis/html.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noSyncScripts",
    group: "performance",
    severity: "warn",
    recommended: false,
    fix: "none",
    languages: ["html"],
    domains: { next: "all", react: "all" },
    create: (context) => ({
        HtmlElement(node) {
            if (node.tag !== "script" || node.closing === null) return;
            if (
                !Html.has(node, "src") ||
                Html.has(node, "async") ||
                Html.has(node, "defer") ||
                Html.value(Html.attribute(node, "type")) === "module"
            )
                return;
            context.report(
                Html.opening(node),
                "Unexpected synchronous script.",
            );
        },
    }),
});
