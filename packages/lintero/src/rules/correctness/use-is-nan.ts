import type { Node } from "@aljazmc/syntax";
import type Context from "../../analysis/context.js";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

const nan = (context: Context, node: Node): boolean => {
    const current = Nodes.unwrap(node);
    if (current.type === "Identifier")
        return current.name === "NaN" && context.semantic.isGlobal(current);
    if (current.type !== "MemberExpression") return false;
    const object = Nodes.unwrap(current.object);
    return (
        Nodes.key(current.property, current.computed) === "NaN" &&
        object.type === "Identifier" &&
        object.name === "Number" &&
        context.semantic.isGlobal(object)
    );
};

export default rule({
    name: "useIsNan",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    create: (context) => ({
        BinaryExpression(node) {
            if (
                ["==", "===", "!=", "!==", "<", ">", "<=", ">="].includes(
                    node.operator,
                ) &&
                (nan(context, node.left) || nan(context, node.right))
            )
                context.report(
                    node,
                    "Use the Number.isNaN function to compare with NaN.",
                );
        },
        SwitchStatement(node) {
            if (nan(context, node.discriminant))
                context.report(
                    node.discriminant,
                    "'switch(NaN)' can never match a case clause. Use Number.isNaN instead of the switch.",
                );
            for (const clause of node.cases)
                if (clause.test && nan(context, clause.test))
                    context.report(
                        context.outer(clause.test),
                        "'case NaN' can never match. Use Number.isNaN before the switch.",
                    );
        },
        CallExpression(node) {
            const member = Nodes.member(node.callee);
            const [argument] = node.arguments;
            if (
                member &&
                ["indexOf", "lastIndexOf"].includes(member.name) &&
                node.arguments.length <= 2 &&
                argument &&
                nan(context, argument)
            )
                context.report(
                    node,
                    `Array.prototype.${member.name} can't find NaN. Use Array.prototype.${member.name === "indexOf" ? "findIndex" : "findLastIndex"} with Number.isNaN instead.`,
                );
        },
    }),
});
