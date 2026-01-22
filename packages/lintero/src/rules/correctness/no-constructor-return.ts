import { type Node, Walker } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

/** Return statements of a function body, not of nested functions or classes. */
export const returns = (node: Node, found: Node[] = []): Node[] => {
    for (const child of Walker.children(node)) {
        if (Nodes.isFunction(child) || child.type === "ClassBody") continue;
        if (child.type === "ReturnStatement") found.push(child);
        returns(child, found);
    }
    return found;
};

export default rule({
    name: "noConstructorReturn",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        MethodDefinition(node) {
            if (node.kind !== "constructor" || !node.value.body) return;
            for (const statement of returns(node.value.body))
                if (statement.type === "ReturnStatement" && statement.argument)
                    context.report(
                        statement,
                        "The constructor should not return a value.",
                    );
        },
    }),
});
