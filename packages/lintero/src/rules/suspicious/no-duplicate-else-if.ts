import type { Node } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

const split = (node: Node, operator: string): Node[] =>
    node.type === "LogicalExpression" && node.operator === operator
        ? [...split(node.left, operator), ...split(node.right, operator)]
        : [node];

const subset = (a: Node[], b: Node[]) =>
    a.every((x) => b.some((y) => Nodes.same(x, y)));

export default rule({
    name: "noDuplicateElseIf",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        IfStatement(node) {
            const { test } = node;
            const conditions =
                test.type === "LogicalExpression" && test.operator === "&&"
                    ? [test, ...split(test, "&&")]
                    : [test];
            let list = conditions.map((condition) =>
                split(condition, "||").map((operand) => split(operand, "&&")),
            );

            let current: Node = node;
            for (
                let parent = context.parent(current);
                parent?.type === "IfStatement" && parent.alternate === current;
                parent = context.parent(current)
            ) {
                current = parent;
                const previous = split(parent.test, "||").map((operand) =>
                    split(operand, "&&"),
                );
                list = list.map((operands) =>
                    operands.filter(
                        (operand) =>
                            !previous.some((other) => subset(other, operand)),
                    ),
                );
                if (list.some((operands) => operands.length === 0)) {
                    context.report(
                        test,
                        "This condition is a duplicate of, or is covered by, previous conditions in the if-else-if chain.",
                    );
                    return;
                }
            }
        },
    }),
});
