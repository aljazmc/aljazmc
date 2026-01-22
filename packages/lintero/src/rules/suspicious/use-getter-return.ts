import { type Node, Walker } from "@aljazmc/syntax";
import Flow from "../../analysis/flow.js";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

/** Bare `return;` statements of a function, not of nested ones. */
const bareReturns = (node: Node, found: Node[]): Node[] => {
    for (const child of Walker.children(node)) {
        if (Nodes.isFunction(child) || child.type === "ClassBody") continue;
        if (child.type === "ReturnStatement" && !child.argument)
            found.push(child);
        bareReturns(child, found);
    }
    return found;
};

export default rule({
    name: "useGetterReturn",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => {
        const check = (getter: Node, fn: Node) => {
            if (
                fn.type !== "FunctionExpression" ||
                !fn.body ||
                fn.body.type !== "BlockStatement"
            )
                return;
            for (const statement of bareReturns(fn.body, []))
                context.report(
                    statement,
                    "This return should return a value because it is located in a getter.",
                );
            if (Flow.list(fn.body.body).has("normal"))
                context.report(getter, "This getter should return a value.");
        };
        return {
            MethodDefinition(node) {
                if (node.kind === "get") check(node, node.value);
            },
            Property(node) {
                if (node.kind === "get") check(node, node.value);
            },
        };
    },
});
