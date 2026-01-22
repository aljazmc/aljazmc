import { type Node, Walker } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

/** Whether a break or continue in a statement targets a label. */
const used = (node: Node, label: string): boolean =>
    Walker.children(node).some((child) => {
        if (Nodes.isFunction(child) || child.type === "ClassBody") return false;
        if (
            (child.type === "BreakStatement" ||
                child.type === "ContinueStatement") &&
            child.label?.name === label
        )
            return true;
        return used(child, label);
    });

export default rule({
    name: "noUnusedLabels",
    group: "correctness",
    severity: "warn",
    recommended: true,
    fix: "safe",
    languages: ["js"],
    create: (context) => ({
        LabeledStatement(node) {
            // labels of other statements are markers, like `DEV:` for bundlers
            const breakable = [
                "BlockStatement",
                "DoWhileStatement",
                "ForInStatement",
                "ForOfStatement",
                "ForStatement",
                "SwitchStatement",
                "WhileStatement",
            ].includes(node.body.type);
            if (!breakable || used(node.body, node.label.name)) return;
            context.report(node.label, "Unused label.", {
                message: "Remove the unused label.",
                edits: [{ start: node.start, end: node.body.start, text: "" }],
            });
        },
    }),
});
