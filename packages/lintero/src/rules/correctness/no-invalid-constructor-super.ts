import type { Node } from "@aljazmc/syntax";
import { Walker } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

/** `super` callees of calls in a constructor, outside nested non-arrow functions. */
const superCalls = (node: Node): Node[] =>
    Walker.children(node).flatMap((child) => {
        if (
            (Nodes.isFunction(child) &&
                child.type !== "ArrowFunctionExpression") ||
            child.type === "ClassBody"
        )
            return [];
        if (child.type === "CallExpression" && child.callee.type === "Super")
            return [child.callee, ...superCalls(child)];
        return superCalls(child);
    });

/** Whether an extends clause can never be a constructor. */
const nonConstructor = (superClass: Node): boolean => {
    const node = Nodes.unwrap(superClass);
    return (
        [
            "NumericLiteral",
            "StringLiteral",
            "BooleanLiteral",
            "NullLiteral",
            "TemplateLiteral",
            "RegExpLiteral",
            "ArrayExpression",
            "ObjectExpression",
        ].includes(node.type) ||
        (node.type === "Identifier" && node.name === "undefined")
    );
};

export default rule({
    name: "noInvalidConstructorSuper",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        MethodDefinition(node) {
            if (node.kind !== "constructor" || !node.value.body) return;
            const body = context.parent(node);
            const owner = body && context.parent(body);
            if (
                owner?.type !== "ClassDeclaration" &&
                owner?.type !== "ClassExpression"
            )
                return;

            for (const callee of superCalls(node.value.body)) {
                if (!owner.superClass)
                    context.report(
                        callee,
                        "This class should not have a super() call. You should remove it.",
                    );
                else if (nonConstructor(owner.superClass))
                    context.report(
                        callee,
                        "This class calls super(), but the class extends from a non-constructor.",
                    );
            }
        },
    }),
});
