import type { Node, NodeOf } from "@aljazmc/syntax";
import Nodes from "./nodes.js";

type Element = NodeOf<"JSXElement">;
type Attribute = NodeOf<"JSXAttribute">;

/** A statically known attribute value: true for a bare attribute, null when dynamic. */
export type Value =
    | string
    | number
    | boolean
    | undefined
    | null
    | { dynamic: Node };

/** Helpers for JSX elements and their attributes. */
// biome-ignore lint/complexity/noStaticOnlyClass: groups JSX helpers
export default class Jsx {
    static attribute(element: Element, name: string): Attribute | undefined {
        return element.attributes.findLast(
            (attribute): attribute is Attribute =>
                attribute.type === "JSXAttribute" && attribute.name === name,
        );
    }

    static spreads(element: Element): boolean {
        return element.attributes.some(
            (attribute) => attribute.type === "JSXSpreadAttribute",
        );
    }

    /** Whether the element is an intrinsic, lowercase HTML one. */
    static intrinsic(element: Element): boolean {
        return (
            /^[a-z]/.test(element.name ?? "") && !element.name?.includes(".")
        );
    }

    /** The static value of an attribute, or `{ dynamic }` with its expression. */
    static value(attribute: Attribute): Value {
        const { value } = attribute;
        if (!value) return true;
        if (value.type === "StringLiteral") return value.raw.slice(1, -1);
        if (value.type !== "JSXExpressionContainer" || !value.expression)
            return { dynamic: value };
        return Jsx.expression(value.expression);
    }

    /** The static value of an expression, like an attribute or an object property value. */
    static expression(node: Node): Value {
        const expression = Nodes.unwrap(node);
        const string = Nodes.string(expression);
        if (string !== undefined) return string;
        switch (expression.type) {
            case "NumericLiteral":
                return Nodes.number(expression.raw);
            case "BooleanLiteral":
                return expression.value;
            case "NullLiteral":
                return null;
            case "Identifier":
                return expression.name === "undefined"
                    ? undefined
                    : { dynamic: expression };
            case "UnaryExpression":
                if (
                    expression.operator === "-" &&
                    expression.argument.type === "NumericLiteral"
                )
                    return -Nodes.number(expression.argument.raw);
                return { dynamic: expression };
            default:
                return { dynamic: expression };
        }
    }

    /** Whether an attribute is set to a truthy value, like `aria-hidden` or `aria-hidden="true"`. */
    static truthy(element: Element, name: string): boolean {
        const attribute = Jsx.attribute(element, name);
        if (!attribute) return false;
        const value = Jsx.value(attribute);
        return value === true || value === "true";
    }

    /** The range of the opening tag, up to its `>`. */
    static opening(
        element: Element,
        context: { find(value: string, from: number): { end: number } },
    ): { start: number; end: number } {
        if (element.selfClosing) return element;
        const last = element.attributes.at(-1);
        const from = last
            ? last.end
            : element.start + 1 + (element.name ?? "").length;
        return { start: element.start, end: context.find(">", from).end };
    }

    static dynamic(value: Value): value is { dynamic: Node } {
        return typeof value === "object" && value !== null;
    }
}
