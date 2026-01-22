import Jsx from "../../analysis/jsx.js";
import { rule } from "../../rules.js";

const redundant = /\b(?:image|picture|photo)\b/i;

export default rule({
    name: "noRedundantAlt",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["jsx"],
    create: (context) => ({
        JSXElement(node) {
            if (node.name !== "img" || Jsx.truthy(node, "aria-hidden")) return;
            const alt = Jsx.attribute(node, "alt");
            if (!alt?.value) return;

            const value = Jsx.value(alt);
            let text: string | undefined;
            if (typeof value === "string") text = value;
            else if (
                Jsx.dynamic(value) &&
                value.dynamic.type === "TemplateLiteral"
            )
                text = value.dynamic.quasis.map((quasi) => quasi.raw).join(" ");

            if (text !== undefined && redundant.test(text))
                context.report(
                    alt.value,
                    'Avoid the words "image", "picture", or "photo" in img element alt text.',
                );
        },
    }),
});
