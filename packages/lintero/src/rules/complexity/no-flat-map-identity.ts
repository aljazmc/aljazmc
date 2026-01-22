import type { Node } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

/** The expression a callback returns, when it does nothing else. */
export const returned = (callback: Node): Node | undefined => {
    if (
        callback.type !== "ArrowFunctionExpression" &&
        callback.type !== "FunctionExpression"
    )
        return;
    const { body } = callback;
    if (!body) return;
    if (body.type !== "BlockStatement")
        return callback.type === "ArrowFunctionExpression" ? body : undefined;
    const [statement] = body.body;
    if (body.body.length === 1 && statement?.type === "ReturnStatement")
        return statement.argument ?? undefined;
};

export default rule({
    name: "noFlatMapIdentity",
    group: "complexity",
    severity: "info",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    create: (context) => ({
        CallExpression(node) {
            const callee = Nodes.unwrap(node.callee);
            const [callback] = node.arguments;
            if (
                callee.type !== "MemberExpression" ||
                Nodes.key(callee.property, callee.computed) !== "flatMap" ||
                node.arguments.length !== 1 ||
                !callback ||
                (callback.type !== "ArrowFunctionExpression" &&
                    callback.type !== "FunctionExpression")
            )
                return;

            const [parameter] = callback.params;
            const value = returned(callback);
            if (
                callback.params.length !== 1 ||
                parameter?.type !== "Identifier" ||
                value?.type !== "Identifier" ||
                value.name !== parameter.name
            )
                return;

            context.report(
                node,
                "Avoid unnecessary callback in flatMap call.",
                {
                    message:
                        "Replace unnecessary flatMap call to flat instead.",
                    edits: [
                        {
                            start: callee.property.start,
                            end: node.end,
                            text: "flat()",
                        },
                    ],
                },
            );
        },
    }),
});
