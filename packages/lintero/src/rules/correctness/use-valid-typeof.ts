import type { Node } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

const types = [
    "bigint",
    "boolean",
    "function",
    "number",
    "object",
    "string",
    "symbol",
    "undefined",
];

const isTypeof = (node: Node) =>
    node.type === "UnaryExpression" && node.operator === "typeof";

export default rule({
    name: "useValidTypeof",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    create: (context) => ({
        BinaryExpression(node) {
            if (!["==", "===", "!=", "!=="].includes(node.operator)) return;
            const left = Nodes.unwrap(node.left);
            const right = Nodes.unwrap(node.right);
            const other = isTypeof(left)
                ? right
                : isTypeof(right)
                  ? left
                  : undefined;
            if (!other || isTypeof(other)) return;

            const value = Nodes.string(other);
            if (value !== undefined) {
                if (!types.includes(value))
                    context.report(
                        other,
                        `"${value}" is not a valid typeof value.`,
                    );
                return;
            }
            const invalid =
                [
                    "NumericLiteral",
                    "BooleanLiteral",
                    "NullLiteral",
                    "RegExpLiteral",
                    "TemplateLiteral",
                    "ObjectExpression",
                    "ArrayExpression",
                ].includes(other.type) ||
                (other.type === "Identifier" &&
                    other.name === "undefined" &&
                    context.semantic.isGlobal(other));
            if (invalid) context.report(other, "Invalid typeof comparison.");
        },
    }),
});
