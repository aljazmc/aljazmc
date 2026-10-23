import Jsx from "../../analysis/jsx.js";
import { rule } from "../../rules.js";

export default rule({
    name: "useImageSize",
    group: "correctness",
    severity: "error",
    recommended: false,
    fix: "none",
    languages: ["jsx"],
    domains: { qwik: "recommended" },
    create: (context) => ({
        JSXElement(node) {
            if (
                node.name === "img" &&
                (!Jsx.attribute(node, "width") ||
                    !Jsx.attribute(node, "height"))
            )
                context.report(
                    node,
                    "Missing width or height attribute on img element.",
                );
        },
    }),
});
