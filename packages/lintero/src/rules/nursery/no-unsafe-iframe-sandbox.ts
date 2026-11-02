import Html from "../../analysis/html.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noUnsafeIframeSandbox",
    group: "nursery",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["html"],
    create: (context) => ({
        HtmlElement(node) {
            if (node.tag !== "iframe") return;
            const sandbox = Html.attribute(node, "sandbox");
            const value = Html.value(sandbox);
            if (!sandbox || value === undefined) return;
            const tokens = value
                .split(/[\t\n\f\r ]+/)
                .map((token) => token.toLowerCase());
            if (
                tokens.includes("allow-scripts") &&
                tokens.includes("allow-same-origin")
            )
                context.report(
                    sandbox,
                    "Unsafe combination of allow-scripts and allow-same-origin in the sandbox attribute.",
                );
        },
    }),
});
