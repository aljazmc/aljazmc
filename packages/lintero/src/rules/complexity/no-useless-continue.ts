import type { Node } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

const loops = new Set([
    "ForStatement",
    "ForInStatement",
    "ForOfStatement",
    "WhileStatement",
    "DoWhileStatement",
]);

export default rule({
    name: "noUselessContinue",
    group: "complexity",
    severity: "info",
    recommended: true,
    fix: "safe",
    languages: ["js"],
    create: (context) => ({
        ContinueStatement(node) {
            // the continue must be the last thing its own loop iteration does
            let child: Node = node;
            for (const parent of context.ancestors(node)) {
                if (loops.has(parent.type)) {
                    const label = context.parent(parent);
                    if (
                        node.label &&
                        !(
                            label?.type === "LabeledStatement" &&
                            label.label.name === node.label.name
                        )
                    )
                        return;
                    break;
                }
                if (parent.type === "BlockStatement") {
                    if (parent.body.at(-1) !== child) return;
                } else if (parent.type === "IfStatement") {
                    if (parent.test === child) return;
                } else if (
                    parent.type !== "LabeledStatement" &&
                    parent.type !== "CatchClause" &&
                    parent.type !== "TryStatement"
                )
                    return;
                child = parent;
            }

            const parent = context.parent(node);
            context.report(
                node,
                "Unnecessary continue statement",
                parent?.type === "BlockStatement"
                    ? {
                          message: "Delete the unnecessary continue statement",
                          edits: [
                              { start: node.start, end: node.end, text: "" },
                          ],
                      }
                    : undefined,
            );
        },
    }),
});
