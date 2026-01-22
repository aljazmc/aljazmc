import type { Node } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

export default rule({
    name: "noAssignInExpressions",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        AssignmentExpression(node) {
            let child: Node = node;
            let parent = context.parent(node);
            // chains like `a = b = c`, and sequences of assignments, are statements too
            while (
                parent?.type === "SequenceExpression" ||
                (parent?.type === "AssignmentExpression" &&
                    parent.right === child)
            ) {
                child = parent;
                parent = context.parent(parent);
            }

            if (
                parent?.type === "ExpressionStatement" ||
                (parent?.type === "ForStatement" && parent.test !== child) ||
                (parent?.type === "ArrowFunctionExpression" &&
                    parent.body === child &&
                    child.type !== "SequenceExpression")
            )
                return;

            context.report(
                node,
                "The assignment should not be in an expression.",
            );
        },
    }),
});
