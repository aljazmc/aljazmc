import Jsx from "../../analysis/jsx.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noSvgWithoutTitle",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["jsx"],
    create: (context) => ({
        JSXElement(node) {
            if (node.name !== "svg" || Jsx.spreads(node)) return;
            if (Jsx.truthy(node, "aria-hidden")) return;
            const role = Jsx.attribute(node, "role");
            const roleValue = role && Jsx.value(role);
            if (Jsx.dynamic(roleValue)) return;
            if (["img", "presentation", "none"].includes(String(roleValue)))
                return;

            const titled = node.children.some(
                (child) =>
                    child.type === "JSXElement" &&
                    child.name === "title" &&
                    child.children.some(
                        (text) =>
                            text.type === "JSXText" && text.raw.trim() !== "",
                    ),
            );
            if (!titled)
                context.report(
                    Jsx.opening(node, context),
                    "Alternative text title element cannot be empty",
                );
        },
    }),
});
