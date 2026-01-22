import type { Node } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noExtraBooleanCast",
    group: "complexity",
    severity: "info",
    recommended: true,
    fix: "safe",
    languages: ["js"],
    create: (context) => {
        const booleanCall = (node: Node) =>
            (node.type === "CallExpression" || node.type === "NewExpression") &&
            node.callee.type === "Identifier" &&
            node.callee.name === "Boolean" &&
            context.semantic.isGlobal(node.callee);

        /** Whether a node is coerced to a boolean by where it is. */
        const coerced = (node: Node): boolean => {
            const parent = context.parent(node);
            switch (parent?.type) {
                case "IfStatement":
                case "WhileStatement":
                case "DoWhileStatement":
                case "ConditionalExpression":
                case "ForStatement":
                    return parent.test === node;
                case "UnaryExpression":
                    return parent.operator === "!";
                case "CallExpression":
                case "NewExpression":
                    return booleanCall(parent) && parent.arguments[0] === node;
                case "LogicalExpression":
                    return parent.operator !== "??" && coerced(parent);
                default:
                    return false;
            }
        };

        return {
            UnaryExpression(node) {
                const argument = node.argument;
                if (
                    node.operator === "!" &&
                    argument.type === "UnaryExpression" &&
                    argument.operator === "!" &&
                    coerced(node)
                )
                    context.report(node, "Avoid redundant double-negation.", {
                        message: "Remove redundant double-negation",
                        edits: [
                            {
                                start: node.start,
                                end: node.end,
                                text: context.slice(
                                    context.outer(argument.argument),
                                ),
                            },
                        ],
                    });
            },
            CallExpression(node) {
                const [argument] = node.arguments;
                if (
                    booleanCall(node) &&
                    node.arguments.length === 1 &&
                    argument &&
                    coerced(node)
                )
                    context.report(node, "Avoid redundant `Boolean` call", {
                        message: "Remove redundant `Boolean` call",
                        edits: [
                            {
                                start: node.start,
                                end: node.end,
                                text: context.slice(Nodes.unwrap(argument)),
                            },
                        ],
                    });
            },
        };
    },
});
