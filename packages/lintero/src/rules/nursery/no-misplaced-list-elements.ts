import Html from "../../analysis/html.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noMisplacedListElements",
    group: "nursery",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["html"],
    create: (context) => ({
        HtmlElement(node) {
            if (node.tag !== "li") return;
            const parent = context.htmlParent(node);
            // templates may render their content anywhere
            if (!parent || parent.tag === "template") return;
            if (["ul", "ol", "menu"].includes(parent.tag ?? "")) return;
            context.report(
                Html.opening(node),
                "This <li> element is outside a list container.",
            );
        },
    }),
});
