import Html from "../../analysis/html.js";
import Jsx from "../../analysis/jsx.js";
import { rule } from "../../rules.js";

const pairs = [
    ["onMouseOver", "onFocus"],
    ["onMouseOut", "onBlur"],
] as const;

export default rule({
    name: "useKeyWithMouseEvents",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["html", "jsx"],
    create: (context) => ({
        JSXElement(node) {
            if (!Jsx.intrinsic(node) || Jsx.spreads(node)) return;
            for (const [mouse, keyboard] of pairs)
                if (
                    Jsx.attribute(node, mouse) &&
                    !Jsx.attribute(node, keyboard)
                )
                    context.report(
                        Jsx.opening(node, context),
                        `${mouse} must be accompanied by ${keyboard} for accessibility.`,
                    );
        },
        HtmlElement(node) {
            if (Html.has(node, "onmouseover") && !Html.has(node, "onfocus"))
                context.report(
                    Html.opening(node),
                    "onmouseover must be accompanied by onfocus.",
                );
            else if (Html.has(node, "onmouseout") && !Html.has(node, "onblur"))
                context.report(
                    Html.opening(node),
                    "onmouseout must be accompanied by onblur.",
                );
        },
    }),
});
