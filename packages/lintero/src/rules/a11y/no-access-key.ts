import Jsx from "../../analysis/jsx.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noAccessKey",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "unsafe",
    languages: ["html", "jsx"],
    create: (context) => ({
        JSXElement(node) {
            if (!Jsx.intrinsic(node)) return;
            const attribute = Jsx.attribute(node, "accessKey");
            if (!attribute) return;
            const value = Jsx.value(attribute);
            if (value === undefined || value === null) return;
            context.report(attribute, "Avoid the accessKey attribute.", {
                message: "Remove the accessKey attribute.",
                edits: [
                    {
                        start: attribute.start,
                        end: attribute.end,
                        text: "",
                    },
                ],
            });
        },
        HtmlElement(node) {
            for (const attribute of node.attributes)
                if (attribute.name.toLowerCase() === "accesskey")
                    context.report(
                        attribute,
                        "Avoid the accesskey attribute.",
                        {
                            message: "Remove the accesskey attribute.",
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
