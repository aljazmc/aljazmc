import type { Node } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

export default rule({
    name: "useDateNow",
    group: "complexity",
    severity: "warn",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    create: (context) => {
        const newDate = (node: Node) => {
            const current = Nodes.unwrap(node);
            return (
                current.type === "NewExpression" &&
                current.callee.type === "Identifier" &&
                current.callee.name === "Date" &&
                current.arguments.length === 0 &&
                context.semantic.isGlobal(current.callee)
            );
        };
        const report = (node: Node, replaced: string) =>
            context.report(node, `Use Date.now() instead of ${replaced}.`, {
                message: "Replace with Date.now().",
                edits: [
                    { start: node.start, end: node.end, text: "Date.now()" },
                ],
            });
        return {
            CallExpression(node) {
                const member = Nodes.member(node.callee);
                if (
                    member &&
                    ["getTime", "valueOf"].includes(member.name) &&
                    node.arguments.length === 0 &&
                    newDate(member.object)
                )
                    report(node, `new Date().${member.name}()`);
                const [argument] = node.arguments;
                if (
                    node.callee.type === "Identifier" &&
                    node.callee.name === "Number" &&
                    node.arguments.length === 1 &&
                    argument &&
                    newDate(argument)
                )
                    report(node, "Number(new Date())");
            },
            UnaryExpression(node) {
                if (
                    (node.operator === "+" || node.operator === "-") &&
                    newDate(node.argument)
                )
                    report(node, "new Date()");
            },
            BinaryExpression(node) {
                if (!["-", "*", "/", "%", "**"].includes(node.operator)) return;
                for (const side of [node.left, node.right])
                    if (newDate(side)) report(Nodes.unwrap(side), "new Date()");
            },
            AssignmentExpression(node) {
                if (
                    ["-=", "*=", "/=", "%=", "**="].includes(node.operator) &&
                    newDate(node.right)
                )
                    report(Nodes.unwrap(node.right), "new Date()");
            },
        };
    },
});
