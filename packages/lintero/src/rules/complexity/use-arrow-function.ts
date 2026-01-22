import { type Node, Walker } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

/** Whether a function body uses its own `this`, `arguments` or `new.target`. */
const binds = (node: Node): boolean =>
    Walker.children(node).some((child) => {
        if (
            child.type === "FunctionDeclaration" ||
            child.type === "FunctionExpression"
        )
            return false;
        if (child.type === "ClassBody") return false;
        if (child.type === "ThisExpression" || child.type === "Super")
            return true;
        if (child.type === "Identifier" && child.name === "arguments")
            return true;
        if (child.type === "MetaProperty" && child.meta === "new") return true;
        if (child.type === "TSThisType") return true;
        return binds(child);
    });

export default rule({
    name: "useArrowFunction",
    group: "complexity",
    severity: "warn",
    recommended: true,
    fix: "safe",
    languages: ["js"],
    create: (context) => ({
        FunctionExpression(node) {
            if (node.generator || node.id || !node.body) return;
            const parent = context.parent(node);
            if (
                parent?.type === "MethodDefinition" ||
                (parent?.type === "Property" &&
                    (parent.method || parent.kind !== "init"))
            )
                return;
            const [first] = node.params;
            if (first?.type === "Identifier" && first.name === "this") return;
            if (binds(node.body) || node.params.some(binds)) return;
            context.report(
                node,
                "This function expression can be turned into an arrow function.",
            );
        },
    }),
});
