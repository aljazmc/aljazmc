import { type Node, Walker } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

const yields = (node: Node): boolean =>
    Walker.children(node).some(
        (child) =>
            !Nodes.isFunction(child) &&
            child.type !== "ClassBody" &&
            (child.type === "YieldExpression" || yields(child)),
    );

export default rule({
    name: "useYield",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => {
        const check = (node: Node, range: Node = node) => {
            if (
                (node.type === "FunctionDeclaration" ||
                    node.type === "FunctionExpression") &&
                node.generator &&
                node.body?.type === "BlockStatement" &&
                node.body.body.length > 0 &&
                !yields(node.body)
            )
                context.report(
                    range,
                    "This generator function doesn't contain yield.",
                );
        };
        return {
            FunctionDeclaration: (node) => check(node),
            FunctionExpression(node) {
                const parent = context.parent(node);
                check(
                    node,
                    parent?.type === "MethodDefinition" ||
                        (parent?.type === "Property" && parent.method)
                        ? parent
                        : node,
                );
            },
        };
    },
});
