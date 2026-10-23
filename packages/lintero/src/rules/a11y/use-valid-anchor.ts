import type { Node, NodeOf } from "@aljazmc/syntax";
import Jsx from "../../analysis/jsx.js";
import { rule } from "../../rules.js";

type Attribute = NodeOf<"JSXAttribute">;

/** Like Biome, the first attribute of a name counts. */
const attribute = (
    element: NodeOf<"JSXElement">,
    name: string,
): Attribute | undefined =>
    element.attributes.find(
        (attribute): attribute is Attribute =>
            attribute.type === "JSXAttribute" && attribute.name === name,
    );

/** The text of a string or a template without interpolations, as written. */
const text = (node: Node): string | undefined => {
    if (node.type === "StringLiteral") return node.raw.slice(1, -1);
    if (node.type === "TemplateLiteral" && node.expressions.length === 0)
        return node.quasis[0]?.raw;
};

/** Whether `href` is missing a value, or is null, undefined, a number, a boolean, empty, `#` or `javascript:`. */
const invalid = (href: Attribute): boolean => {
    let value: Node | null = href.value;
    if (!value) return true;
    if (value.type === "JSXExpressionContainer") {
        value = value.expression;
        if (!value || value.parenthesized) return false;
        if (
            value.type === "NullLiteral" ||
            value.type === "BooleanLiteral" ||
            value.type === "NumericLiteral" ||
            (value.type === "Identifier" && value.name === "undefined")
        )
            return true;
    }
    const string = text(value);
    return (
        string !== undefined &&
        (string === "" || string === "#" || string.includes("javascript:"))
    );
};

export default rule({
    name: "useValidAnchor",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["jsx"],
    create: (context) => ({
        JSXElement(node) {
            if (node.name !== "a") return;
            const href = attribute(node, "href");
            const onClick = attribute(node, "onClick");
            const button = "Use a button element instead of an a element.";

            if (!href) {
                if (onClick) context.report(onClick, button);
                else if (!Jsx.spreads(node))
                    context.report(
                        Jsx.opening(node, context),
                        "Provide a href attribute for the a element.",
                    );
            } else if (invalid(href)) {
                if (onClick) context.report(Jsx.opening(node, context), button);
                else
                    context.report(
                        href,
                        "Provide a valid value for the attribute href.",
                    );
            }
        },
    }),
});
