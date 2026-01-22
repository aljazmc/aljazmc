import type { Node, NodeOf } from "@aljazmc/syntax";
import { rule } from "../../rules.js";
import { returns } from "./no-constructor-return.js";

export default rule({
    name: "noVoidTypeReturn",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["ts"],
    create: (context) => {
        const check = (
            node: NodeOf<
                | "ArrowFunctionExpression"
                | "FunctionDeclaration"
                | "FunctionExpression"
            >,
        ) => {
            if (!node.returnType || !node.body) return;
            let type: Node = node.returnType;
            while (type.type === "TSParenthesizedType")
                type = type.typeAnnotation;
            if (type.type !== "TSKeyword" || type.name !== "void") return;
            if (node.body.type !== "BlockStatement") return;
            for (const statement of returns(node.body))
                if (statement.type === "ReturnStatement" && statement.argument)
                    context.report(
                        statement,
                        "The function should not return a value because its return type is void.",
                    );
        };
        return {
            FunctionDeclaration: check,
            FunctionExpression: check,
            ArrowFunctionExpression: check,
        };
    },
});
