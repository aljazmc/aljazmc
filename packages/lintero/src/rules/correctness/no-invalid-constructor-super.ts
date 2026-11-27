import type { Node } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

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
            const body = node.value.body;
            if (node.kind !== "constructor" || body?.type !== "BlockStatement")
                return;
            // like Biome, the first statement of the body that calls super()
            let callee: Node | undefined;
            for (const statement of body.body)
                if (
                    statement.type === "ExpressionStatement" &&
                    statement.expression.type === "CallExpression" &&
                    statement.expression.callee.type === "Super"
                ) {
                    callee = statement.expression.callee;
                    break;
                }
            if (!callee) return;

            // the class extends, or without it the closest class around it that does
            let superClass: Node | null = null;
            for (
                let ancestor = context.parent(node);
                ancestor && !superClass;
                ancestor = context.parent(ancestor)
            )
                if (
                    ancestor.type === "ClassDeclaration" ||
                    ancestor.type === "ClassExpression"
                )
                    superClass = ancestor.superClass;

            if (!superClass)
                context.report(
                    callee,
                    "This class should not have a super() call. You should remove it.",
                );
            else if (nonConstructor(superClass))
                context.report(
                    callee,
                    "This class calls super(), but the class extends from a non-constructor.",
                );
        },
    }),
});
