import Jsx from "../../analysis/jsx.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noAutofocus",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "unsafe",
    languages: ["html", "jsx"],
    create: (context) => ({
        JSXElement(node) {
            if (!Jsx.intrinsic(node)) return;
            const attribute = Jsx.attribute(node, "autoFocus");
            if (!attribute || Jsx.value(attribute) === false) return;
            // autofocus is expected in dialogs and popovers
            for (const ancestor of context.ancestors(node))
                if (
                    ancestor.type === "JSXElement" &&
                    (ancestor.name === "dialog" ||
                        Jsx.attribute(ancestor, "popover"))
                )
                    return;
            context.report(attribute, "Avoid the autoFocus attribute.", {
                message: "Remove the autoFocus attribute.",
                edits: [
                    { start: attribute.start, end: attribute.end, text: "" },
                ],
            });
        },
        HtmlElement(node) {
            for (const attribute of node.attributes) {
                if (attribute.name.toLowerCase() !== "autofocus") continue;
                let allowed = false;
                for (const ancestor of context.htmlAncestors(node))
                    if (
                        ancestor.tag === "dialog" ||
                        ancestor.attributes.some(
                            (a) => a.name.toLowerCase() === "popover",
                        )
                    ) {
                        allowed = true;
                        break;
                    }
                if (allowed) continue;
                context.report(
                    attribute,
                    "This element uses the autofocus attribute outside an allowed modal context.",
                    {
                        message: "Remove the autofocus attribute.",
                        edits: [
                            {
                                start: attribute.start,
                                end: attribute.end,
                                text: "",
                            },
                        ],
                    },
                );
            }
        },
    }),
});
