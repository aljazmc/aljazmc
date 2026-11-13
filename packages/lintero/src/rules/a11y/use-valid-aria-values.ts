import type { Node } from "@aljazmc/syntax";
import { properties, type ValueType } from "../../analysis/aria.js";
import Html from "../../analysis/html.js";
import { rule } from "../../rules.js";

/** The static value of an attribute, undefined when only known at runtime. */
const value = (node: Node | null): string | undefined => {
    if (!node) return;
    if (node.type === "StringLiteral") return node.raw.slice(1, -1);
    if (node.type !== "JSXExpressionContainer" || !node.expression) return;
    const expression = node.expression;
    switch (expression.type) {
        case "StringLiteral":
            return expression.raw.slice(1, -1);
        case "TemplateLiteral":
            return expression.expressions.length === 0
                ? expression.quasis[0]?.raw
                : undefined;
        case "BooleanLiteral":
            return String(expression.value);
        case "NumericLiteral":
            return expression.raw;
        case "NullLiteral":
            return "null";
        case "Identifier":
            return expression.name === "undefined" ? "undefined" : undefined;
        default:
            return undefined;
    }
};

const valid = (text: string, kind: ValueType): boolean => {
    switch (kind.type) {
        case "string":
        case "idrefs":
            return text !== "";
        case "idref":
            return text !== "" && !/\s/.test(text);
        case "boolean":
            return text === "true" || text === "false";
        case "tristate":
            return ["true", "false", "mixed"].includes(text);
        case "optional":
            return ["true", "false", "undefined"].includes(text);
        case "integer":
            return /^\d+$/.test(text);
        case "number":
            return text.trim() !== "" && !Number.isNaN(Number(text));
        case "token":
            return kind.values.includes(text);
        case "tokens": {
            const list = text.split(/\s+/).filter((token) => token !== "");
            return (
                list.length > 0 &&
                list.every((token) => kind.values.includes(token))
            );
        }
    }
};

/** Whether a value has the type. */
const biomeValid = (text: string, kind: ValueType): boolean => {
    if (text === "") return false;
    const words = text.split(/[\t\n\f\r ]+/).filter((word) => word !== "");
    switch (kind.type) {
        case "string":
            return true;
        case "idref":
            return !/[\t\n\f\r ]/.test(text);
        case "idrefs":
            return true;
        case "integer":
            return /^\+?\d+$/.test(text) && Number(text) <= 4294967295;
        case "number":
            return /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$|^[+-]?(?:inf|infinity|nan)$/i.test(
                text,
            );
        case "boolean":
            return text === "true" || text === "false";
        case "optional":
            return ["undefined", "false", "true"].includes(text);
        case "tristate":
            return ["false", "true", "mixed"].includes(text);
        case "token":
            return kind.values.includes(text);
        case "tokens":
            return words.every((word) => kind.values.includes(word));
    }
};

export default rule({
    name: "useValidAriaValues",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["html", "jsx"],
    create: (context) => ({
        JSXAttribute(node) {
            if (!node.name.startsWith("aria-")) return;
            const kind = properties[node.name.slice(5)];
            const text = value(node.value);
            if (kind && text !== undefined && !valid(text, kind))
                context.report(
                    node,
                    `The value of the ARIA attribute ${node.name} is not correct.`,
                );
        },
        HtmlElement(node) {
            for (const attribute of node.attributes) {
                const name = attribute.name;
                const lower = name.toLowerCase();
                if (!lower.startsWith("aria-")) continue;
                const kind = properties[lower.slice(5)];
                if (!kind) continue;
                const text = attribute.value ? Html.value(attribute) : "true";
                if (text === undefined) continue;
                if (!biomeValid(text, kind))
                    context.report(
                        attribute,
                        `The value of the ARIA attribute ${name} is not correct.`,
                    );
            }
        },
    }),
});
