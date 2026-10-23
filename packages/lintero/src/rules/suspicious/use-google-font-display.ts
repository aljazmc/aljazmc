import type { Node } from "@aljazmc/syntax";
import Jsx from "../../analysis/jsx.js";
import { rule } from "../../rules.js";

export default rule({
    name: "useGoogleFontDisplay",
    group: "suspicious",
    severity: "warn",
    recommended: true,
    fix: "none",
    languages: ["jsx"],
    create: (context) => ({
        JSXElement(node) {
            if (node.name !== "link") return;
            let value: Node | null | undefined = Jsx.attribute(
                node,
                "href",
            )?.value;
            if (value?.type === "JSXExpressionContainer")
                value = value.expression;
            if (value?.type !== "StringLiteral") return;
            const href = value.raw.slice(1, -1);
            if (!href.startsWith("https://fonts.googleapis.com/css")) return;
            const query = href.split("#")[0]?.split("?")[1] ?? "";
            const display = new URLSearchParams(query).get("display");
            if (display === null)
                context.report(
                    value,
                    "The Google Font link is missing the display parameter.",
                );
            else if (["auto", "block", "fallback"].includes(display))
                context.report(
                    value,
                    "The Google Font link has a non-recommended display value.",
                );
        },
    }),
});
