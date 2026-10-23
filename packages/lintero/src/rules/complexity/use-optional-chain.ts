import type { Node } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

const message = "Change to an optional chain.";

/** The value a null check tests, like `foo` of `foo != null` or `foo !== undefined`. */
const checked = (node: Node): Node => {
    if (
        node.type !== "BinaryExpression" ||
        !["!=", "!==", "==", "==="].includes(node.operator)
    )
        return node;
    if (node.operator === "==" || node.operator === "===") return node;
    const nullish = (side: Node) =>
        side.type === "NullLiteral" ||
        (side.type === "Identifier" && side.name === "undefined");
    if (nullish(node.right)) return node.left;
    if (nullish(node.left)) return node.right;
    return node;
};

/** Whether `inner` accesses into `outer`, like `foo.bar.baz` or `foo()` into `foo`. */
const extendsChain = (outer: Node, inner: Node): boolean => {
    let current = inner;
    for (;;) {
        if (current.type === "MemberExpression") current = current.object;
        else if (current.type === "CallExpression") current = current.callee;
        else return false;
        if (same(current, outer)) return true;
    }
};

/** Whether two chains are the same, also with `?.` on one of them. */
const same = (a: Node, b: Node): boolean => {
    if (a.type === "MemberExpression" && b.type === "MemberExpression")
        return (
            a.computed === b.computed &&
            Nodes.same(a.property, b.property) &&
            same(a.object, b.object)
        );
    if (a.type === "CallExpression" && b.type === "CallExpression")
        return (
            same(a.callee, b.callee) &&
            a.arguments.length === b.arguments.length &&
            a.arguments.every((argument, index) =>
                Nodes.same(argument, b.arguments[index]),
            )
        );
    return Nodes.same(a, b);
};

/** The operands of a chain like `a && b && c`, up to parentheses. */
const operands = (node: Node, operator: string, root = true): Node[] =>
    node.type === "LogicalExpression" &&
    node.operator === operator &&
    (root || !node.parenthesized)
        ? [
              ...operands(node.left, operator, false),
              ...operands(node.right, operator, false),
          ]
        : [node];

export default rule({
    name: "useOptionalChain",
    group: "complexity",
    severity: "warn",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    create: (context) => {
        const reported: Node[] = [];
        const inside = (node: Node) =>
            reported.some(
                (outer) => outer.start <= node.start && node.end <= outer.end,
            );

        return {
            LogicalExpression(node) {
                if (node.operator !== "&&" && node.operator !== "||") return;
                const parent = context.parent(node);
                if (
                    parent?.type === "LogicalExpression" &&
                    parent.operator === node.operator &&
                    !node.parenthesized
                )
                    return;
                const list = operands(node, node.operator);
                // !foo || !foo.bar
                const values =
                    node.operator === "||"
                        ? list.map((operand) =>
                              operand.type === "UnaryExpression" &&
                              operand.operator === "!"
                                  ? operand.argument
                                  : undefined,
                          )
                        : list.map(checked);
                const chained = values.some((value, index) => {
                    const next = values[index + 1];
                    return (
                        value !== undefined &&
                        next !== undefined &&
                        extendsChain(value, next)
                    );
                });
                if (chained) context.report(node, message);
            },
            MemberExpression(node) {
                // (foo || {}).bar
                const { object } = node;
                if (
                    object.type !== "LogicalExpression" ||
                    !object.parenthesized ||
                    (object.operator !== "||" && object.operator !== "??") ||
                    object.right.type !== "ObjectExpression" ||
                    object.right.properties.length > 0 ||
                    inside(node)
                )
                    return;
                const range = {
                    start: context.outer(object).start,
                    end: node.end,
                };
                // report the outermost of nested ones, like ((foo || {}).bar || {}).baz
                let outer: Node = node;
                for (
                    let current = context.parent(node);
                    current;
                    current = context.parent(current)
                ) {
                    if (
                        current.type === "MemberExpression" &&
                        current.object.type === "LogicalExpression" &&
                        current.object.parenthesized &&
                        current.object.right.type === "ObjectExpression"
                    )
                        outer = current;
                    else if (
                        current.type !== "LogicalExpression" &&
                        current.type !== "AwaitExpression" &&
                        current.type !== "MemberExpression"
                    )
                        break;
                }
                if (outer !== node) return;
                reported.push(node);
                context.report(range, message);
            },
        };
    },
});
