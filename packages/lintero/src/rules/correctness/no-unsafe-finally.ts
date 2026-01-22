import type { Node } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noUnsafeFinally",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => {
        /** Whether a jump leaves the finally block it is in. */
        const escapes = (
            node: Node,
            label: string | undefined,
            loopOnly: boolean,
        ): boolean => {
            let child = node;
            for (const ancestor of context.ancestors(node)) {
                if (Nodes.isFunction(ancestor) || ancestor.type === "ClassBody")
                    return false;
                if (
                    ancestor.type === "TryStatement" &&
                    ancestor.finalizer === child
                )
                    return true;
                if (label === undefined) {
                    const loop = [
                        "WhileStatement",
                        "DoWhileStatement",
                        "ForStatement",
                        "ForInStatement",
                        "ForOfStatement",
                    ].includes(ancestor.type);
                    if (
                        loop ||
                        (!loopOnly && ancestor.type === "SwitchStatement")
                    )
                        return false;
                } else if (
                    ancestor.type === "LabeledStatement" &&
                    ancestor.label.name === label
                )
                    return false;
                child = ancestor;
            }
            return false;
        };
        const report = (node: Node, keyword: string) =>
            context.report(node, `Unsafe usage of '${keyword}'.`);
        return {
            ReturnStatement(node) {
                if (escapes(node, undefined, false) || escapesAny(node))
                    report(node, "return");
            },
            ThrowStatement(node) {
                if (escapesAny(node)) report(node, "throw");
            },
            BreakStatement(node) {
                if (escapes(node, node.label?.name, false))
                    report(node, "break");
            },
            ContinueStatement(node) {
                if (escapes(node, node.label?.name, true))
                    report(node, "continue");
            },
        };

        /** Whether a return or throw is inside a finally block of its function. */
        function escapesAny(node: Node): boolean {
            let child = node;
            for (const ancestor of context.ancestors(node)) {
                if (Nodes.isFunction(ancestor) || ancestor.type === "ClassBody")
                    return false;
                if (
                    ancestor.type === "TryStatement" &&
                    ancestor.finalizer === child
                )
                    return true;
                child = ancestor;
            }
            return false;
        }
    },
});
