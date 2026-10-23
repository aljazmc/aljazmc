import { properties } from "../../analysis/aria.js";
import Jsx from "../../analysis/jsx.js";
import { rule } from "../../rules.js";

export default rule({
    name: "useValidAriaProps",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "unsafe",
    languages: ["jsx"],
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
    }),
});
