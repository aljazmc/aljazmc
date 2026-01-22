import type { Node } from "@aljazmc/syntax";
import type Context from "../../analysis/context.js";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

/** The name shown for an assigned expression, its last identifier. */
const name = (node: Node): string => {
    if (node.type === "Identifier") return node.name;
    if (node.type === "MemberExpression")
        return Nodes.key(node.property, node.computed) ?? name(node.property);
    return "";
};

/** Whether two member expressions access the same thing, all of their parts static. */
const sameMember = (left: Node, right: Node): boolean => {
    if (left.type === "Identifier" && right.type === "Identifier")
        return left.name === right.name;
    if (left.type === "ThisExpression" && right.type === "ThisExpression")
        return true;
    if (left.type !== "MemberExpression" || right.type !== "MemberExpression")
        return false;
    const leftKey = left.computed ? left.property : undefined;
    const rightKey = right.computed ? right.property : undefined;
    const keys =
        Nodes.key(left.property, left.computed) !== undefined
            ? Nodes.key(left.property, left.computed) ===
              Nodes.key(right.property, right.computed)
            : leftKey !== undefined &&
              rightKey !== undefined &&
              sameMember(leftKey, rightKey);
    return keys && sameMember(left.object, right.object);
};

const check = (context: Context, left: Node, right: Node): void => {
    if (left.type === "ArrayPattern" && right.type === "ArrayExpression") {
        for (const [index, element] of left.elements.entries()) {
            const other = right.elements[index];
            if (!element || !other) continue;
            if (
                element.type === "RestElement" ||
                other.type === "SpreadElement"
            )
                break;
            check(context, element, other);
        }
        return;
    }
    if (left.type === "ObjectPattern" && right.type === "ObjectExpression") {
        if (
            right.properties.some(
                (property) => property.type === "SpreadElement",
            )
        )
            return;
        for (const property of left.properties) {
            if (property.type !== "Property") continue;
            const key = Nodes.key(property.key, property.computed);
            const other = right.properties.findLast(
                (candidate) =>
                    candidate.type === "Property" &&
                    Nodes.key(candidate.key, candidate.computed) === key,
            );
            if (
                key !== undefined &&
                other?.type === "Property" &&
                other.kind === "init"
            )
                check(context, property.value, other.value);
        }
        return;
    }
    const target = Nodes.unwrap(right);
    if (sameMember(Nodes.unwrap(left), target))
        context.report(
            target.type === "MemberExpression" ? target.property : target,
            `${name(target)} is assigned to itself.`,
        );
};

export default rule({
    name: "noSelfAssign",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        AssignmentExpression(node) {
            if (["=", "&&=", "||=", "??="].includes(node.operator))
                check(context, node.left, node.right);
        },
    }),
});
