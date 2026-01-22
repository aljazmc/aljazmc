import type { Node } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

const loops = [
    "DoWhileStatement",
    "ForInStatement",
    "ForOfStatement",
    "ForStatement",
    "WhileStatement",
];

export default rule({
    name: "noUselessLabel",
    group: "complexity",
    severity: "info",
    recommended: true,
    fix: "safe",
    languages: ["js"],
    create: (context) => {
        const check = (node: Node & { label: { name: string } | null }) => {
            if (!node.label) return;
            // the label is useless when the closest breakable statement is the labeled one
            for (const ancestor of context.ancestors(node)) {
                if (
                    loops.includes(ancestor.type) ||
                    (ancestor.type === "SwitchStatement" &&
                        node.type === "BreakStatement")
                ) {
                    const labeled = context.parent(ancestor);
                    if (
                        labeled?.type === "LabeledStatement" &&
                        labeled.label.name === node.label.name
                    )
                        context.report(
                            node.label as Node,
                            "Unnecessary label.",
                            {
                                message: "Remove the unnecessary label.",
                                edits: [
                                    {
                                        start: context.find(
                                            node.type === "BreakStatement"
                                                ? "break"
                                                : "continue",
                                            node.start,
                                        ).end,
                                        end: (node.label as Node).end,
                                        text: "",
                                    },
                                ],
                            },
                        );
                    return;
                }
                if (
                    ancestor.type === "FunctionDeclaration" ||
                    ancestor.type === "FunctionExpression" ||
                    ancestor.type === "ArrowFunctionExpression"
                )
                    return;
            }
        };
        return { BreakStatement: check, ContinueStatement: check };
    },
});
