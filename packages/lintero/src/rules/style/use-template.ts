import type { Node } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

/** The operands of a chain of `+`, left to right. */
const operands = (node: Node): Node[] =>
    node.type === "BinaryExpression" &&
    node.operator === "+" &&
    !node.parenthesized
        ? [...operands(node.left), node.right]
        : [node];

const string = (node: Node) =>
    node.type === "StringLiteral" || node.type === "TemplateLiteral";
const constant = (node: Node) =>
    node.type === "StringLiteral" ||
    (node.type === "TemplateLiteral" && node.expressions.length === 0);

export default rule({
    name: "useTemplate",
    group: "style",
    severity: "info",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    create: (context) => ({
        BinaryExpression(node) {
            if (node.operator !== "+") return;
            const parent = context.parent(node);
            if (
                parent?.type === "BinaryExpression" &&
                parent.operator === "+" &&
                parent.left === node &&
                !node.parenthesized
            )
                return;
            const parts = [...operands(node.left), node.right];
            if (!parts.some(string)) return;
            // strings and templates only join when some are constant and others not
            const constants = parts.filter(constant).length;
            if (
                parts.every(string) &&
                (constants === 0 || constants === parts.length)
            )
                return;
            // like Biome, concatenations over several lines are left alone
            for (const [index, part] of parts.slice(1).entries())
                if (
                    /[\r\n]/.test(
                        context.text.slice(
                            (parts[index] as Node).end,
                            part.start,
                        ),
                    )
                )
                    return;
            context.report(
                node,
                "Template literals are preferred over string concatenation.",
            );
        },
    }),
});
