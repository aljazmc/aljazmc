import Jsx from "../../analysis/jsx.js";
import { rule } from "../../rules.js";

export default rule({
    name: "useHtmlLang",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["jsx"],
    create: (context) => ({
        JSXElement(node) {
            if (node.name !== "html" || Jsx.spreads(node)) return;
            const lang = Jsx.attribute(node, "lang");
            const value = lang ? Jsx.value(lang) : undefined;
            if (
                Jsx.dynamic(value) ||
                (typeof value === "string" && value.trim() !== "")
            )
                return;
            context.report(
                node,
                "Provide a lang attribute when using the html element.",
            );
        },
    }),
});
