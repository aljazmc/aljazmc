import type { Node } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

const message = "Change to an optional chain.";

const nullish = (node: Node): boolean =>
    node.type === "NullLiteral" ||
    (node.type === "Identifier" && node.name === "undefined");

/** The value a null check tests, like `foo` of `foo != null` or `foo !== undefined`. */
const checked = (node: Node): Node => {
    if (
        node.type !== "BinaryExpression" ||
        !["!=", "!==", "==", "==="].includes(node.operator)
    )
        return node;
    if (node.operator === "==" || node.operator === "===") return node;
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

/** Whether a computed key is simple enough to compare: a name or a literal. */
const simpleKey = (node: Node): boolean =>
    node.type === "Identifier" ||
    node.type === "StringLiteral" ||
    node.type === "NumericLiteral";

/**
 * Whether an operand can take part in a chain, like Biome's: a name, or a
 * member access or call on one, where `this` and `super` may start a member
 * access but not stand alone, and computed keys are names or literals.
 */
const chainable = (node: Node, alone = true): boolean => {
    if (node.type === "Identifier") return true;
    if (node.type === "ThisExpression" || node.type === "Super") return !alone;
    if (node.type === "MemberExpression")
        return (
            (!node.computed || simpleKey(node.property)) &&
            chainable(node.object, false)
        );
    if (node.type === "CallExpression") return chainable(node.callee, false);
    return false;
};

/**
 * What an operand of `!a || !a.b || a.b.c !== 1` tests: `a` of the guard
 * `!a`, and of an extension also `a.b.c` of an inequality with a value that
 * is not nullish, which `?.` keeps true when `a` is missing.
 */
const negated = (node: Node, extension: boolean): Node | undefined => {
    if (node.type === "UnaryExpression" && node.operator === "!")
        return chainable(node.argument) ? node.argument : undefined;
    if (
        !extension ||
        node.type !== "BinaryExpression" ||
        (node.operator !== "!==" && node.operator !== "!=")
    )
        return undefined;
    // like Biome, compared with a literal, on either side
    if (literal(node.right) && chainable(node.left)) return node.left;
    if (literal(node.left) && chainable(node.right)) return node.right;
    return undefined;
};

/** A literal value that is not nullish, like `1`, `"a"`, `true` or `` `a` ``. */
const literal = (node: Node): boolean =>
    node.type === "StringLiteral" ||
    node.type === "NumericLiteral" ||
    node.type === "BooleanLiteral" ||
    (node.type === "TemplateLiteral" && node.expressions.length === 0);

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
                const or = node.operator === "||";
                // what each operand guards: `foo` of `foo`, `foo != null` or,
                // in `||` chains, `!foo`; undefined for others, which end it
                const guards = list.map((operand) => {
                    if (or) return negated(operand, false);
                    const value = checked(operand);
                    return chainable(value) ? value : undefined;
                });
                // and what it accesses into the guard before it: `foo.bar`,
                // or in `||` chains `!foo.bar` or `foo.bar !== 1`
                const extensions = list.map((operand) =>
                    or
                        ? negated(operand, true)
                        : chainable(operand)
                          ? operand
                          : undefined,
                );
                let chained = false;
                for (const [index, guard] of guards.entries()) {
                    // like Biome, an operand that guards nothing before the chain ends it
                    if (guard === undefined) break;
                    const next = extensions[index + 1];
                    if (next !== undefined && extendsChain(guard, next)) {
                        chained = true;
                        break;
                    }
                }
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
