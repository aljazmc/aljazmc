import {
    properties as ariaProperties,
    properties,
} from "../../analysis/aria.js";
import Jsx from "../../analysis/jsx.js";
import { rule } from "../../rules.js";

export default rule({
    name: "useValidAriaProps",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "unsafe",
    languages: ["html", "jsx"],
    create: (context) => ({
        JSXElement(node) {
            if (!Jsx.intrinsic(node)) return;
            for (const attribute of node.attributes)
                if (
                    attribute.type === "JSXAttribute" &&
                    attribute.name.startsWith("aria-") &&
                    !Object.hasOwn(properties, attribute.name.slice(5))
                )
                    context.report(
                        node,
                        "The element contains invalid ARIA attribute(s)",
                        {
                            message: `Remove the invalid aria-* attribute ${attribute.name}.`,
                            edits: [
                                {
                                    start: attribute.start,
                                    end: attribute.end,
                                    text: "",
                                },
                            ],
                        },
                    );
        },
        HtmlElement(node) {
            for (const attribute of node.attributes) {
                const name = attribute.name.toLowerCase();
                if (
                    name.startsWith("aria-") &&
                    ariaProperties[name.slice(5)] === undefined
                )
                    context.report(
                        attribute,
                        "The element contains an invalid ARIA attribute.",
                    );
            }
        },
    }),
});
