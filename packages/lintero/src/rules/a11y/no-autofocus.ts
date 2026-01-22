import Jsx from "../../analysis/jsx.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noAutofocus",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "unsafe",
    languages: ["jsx"],
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
    }),
});
