import type { Node } from "@aljazmc/syntax";
import type Context from "../../analysis/context.js";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

/** Whether a node, in a boolean position or not, always evaluates to the same value. */
const constant = (context: Context, node: Node, boolean: boolean): boolean => {
    switch (node.type) {
        case "StringLiteral":
        case "NumericLiteral":
        case "BooleanLiteral":
        case "NullLiteral":
        case "RegExpLiteral":
        case "ArrowFunctionExpression":
        case "FunctionExpression":
        case "ClassExpression":
        case "ObjectExpression":
            return true;
        case "ArrayExpression":
            return (
                boolean ||
                node.elements.every(
                    (element) =>
                        element !== null && constant(context, element, false),
                )
            );
        case "TemplateLiteral":
            return (
                (boolean &&
                    node.quasis.some((quasi) => quasi.raw.length > 0)) ||
                node.expressions.every((expression) =>
                    constant(context, expression, false),
                )
            );
        case "UnaryExpression":
            if (node.operator === "void") return true;
            if (node.operator === "typeof" && boolean) return true;
            if (node.operator === "!")
                return constant(context, node.argument, true);
            return constant(context, node.argument, false);
        case "BinaryExpression":
            return (
                node.operator !== "in" &&
                constant(context, node.left, false) &&
                constant(context, node.right, false)
            );
        case "LogicalExpression": {
            const left = constant(context, node.left, boolean);
            const right = constant(context, node.right, boolean);
            return (
                (left && right) ||
                (left && identity(node.left, node.operator)) ||
                (boolean && right && identity(node.right, node.operator))
            );
        }
        case "NewExpression":
            return boolean;
        case "AssignmentExpression":
            if (node.operator === "=")
                return constant(context, node.right, boolean);
            if (["&&=", "||="].includes(node.operator) && boolean)
                return identity(node.right, node.operator.slice(0, -1));
            return false;
        case "SequenceExpression": {
            const last = node.expressions.at(-1);
            return last !== undefined && constant(context, last, boolean);
        }
        case "SpreadElement":
            return constant(context, node.argument, boolean);
        case "CallExpression": {
            const [argument] = node.arguments;
            return (
                node.callee.type === "Identifier" &&
                node.callee.name === "Boolean" &&
                context.semantic.isGlobal(node.callee) &&
                (argument === undefined || constant(context, argument, true))
            );
        }
        case "Identifier":
            return node.name === "undefined" && context.semantic.isGlobal(node);
        case "TSAsExpression":
        case "TSSatisfiesExpression":
        case "TSNonNullExpression":
        case "TSTypeAssertion":
            return constant(context, Nodes.unwrap(node), boolean);
        default:
            return false;
    }
};

/** Whether a node short circuits a logical operator, like `true ||`. */
const identity = (node: Node, operator: string): boolean => {
    switch (node.type) {
        case "StringLiteral":
        case "NumericLiteral":
        case "BooleanLiteral":
        case "NullLiteral":
        case "RegExpLiteral": {
            const truthy =
                node.type === "StringLiteral"
                    ? node.raw.length > 2
                    : node.type === "NumericLiteral"
                      ? Nodes.number(node.raw) !== 0
                      : node.type === "BooleanLiteral"
                        ? node.value
                        : node.type === "RegExpLiteral";
            return (
                (operator === "||" && truthy) || (operator === "&&" && !truthy)
            );
        }
        case "UnaryExpression":
            return operator === "&&" && node.operator === "void";
        case "LogicalExpression":
            return (
                operator === node.operator &&
                (identity(node.left, operator) ||
                    identity(node.right, operator))
            );
        default:
            return false;
    }
};

export default rule({
    name: "noConstantCondition",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => {
        const check = (test: Node | null, node: Node) => {
            if (!test || !constant(context, test, true)) return;
            // `while (true)` is the idiomatic infinite loop
            if (
                node.type === "WhileStatement" &&
                test.type === "BooleanLiteral" &&
                test.value
            )
                return;
            context.report(
                test,
                "This condition always evaluates to the same value.",
            );
        };
        return {
            IfStatement: (node) => check(node.test, node),
            ConditionalExpression: (node) => check(node.test, node),
            WhileStatement: (node) => check(node.test, node),
            DoWhileStatement: (node) => check(node.test, node),
            ForStatement: (node) => check(node.test, node),
        };
    },
});
