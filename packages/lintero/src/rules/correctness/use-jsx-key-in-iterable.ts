import type { Node } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import React from "../../analysis/react.js";
import { rule } from "../../rules.js";

/** Methods taking a callback that returns an element per item. */
const methods = [
    "every",
    "filter",
    "find",
    "findIndex",
    "flatMap",
    "forEach",
    "map",
    "reduce",
    "reduceRight",
    "some",
];

export default rule<{ checkShorthandFragments?: boolean }>({
    name: "useJsxKeyInIterable",
    group: "correctness",
    severity: "error",
    recommended: false,
    fix: "none",
    languages: ["js", "jsx"],
    domains: { react: "recommended", qwik: "recommended" },
    options: { checkShorthandFragments: false },
    create: (context) => {
        const message = "Missing key property for this element in iterable.";

        /** Reports an element without a key, or a `createElement` call without props. */
        const check = (node: Node | null | undefined) => {
            if (!node) return;
            if (node.type === "ConditionalExpression") {
                check(node.consequent);
                check(node.alternate);
            } else if (node.type === "JSXElement") {
                const fragment = node.name === null;
                if (fragment && !context.options.checkShorthandFragments)
                    return;
                const keyed = node.attributes.some(
                    (attribute) =>
                        attribute.type === "JSXAttribute" &&
                        attribute.name === "key",
                );
                if (!keyed)
                    context.report(
                        { start: node.start, end: node.start + 1 },
                        message,
                    );
            } else if (
                node.type === "CallExpression" &&
                node.arguments.length === 1 &&
                React.is(context, node.callee, "createElement")
            )
                // at the arguments
                context.report(context.find("(", node.callee.end), message);
        };

        /** Like Biome, returns and declarations of a callback body, also in if blocks and switch cases. */
        const statements = (list: Node[]) => {
            for (const statement of list)
                switch (statement.type) {
                    case "ReturnStatement":
                        check(statement.argument);
                        break;
                    case "VariableDeclaration":
                        for (const declarator of statement.declarations)
                            if (declarator.type === "VariableDeclarator")
                                check(declarator.init);
                        break;
                    case "IfStatement":
                        if (
                            statement.consequent.type === "BlockStatement" &&
                            (!statement.alternate ||
                                statement.alternate.type === "BlockStatement")
                        ) {
                            statements(statement.consequent.body);
                            if (statement.alternate?.type === "BlockStatement")
                                statements(statement.alternate.body);
                        }
                        break;
                    case "SwitchStatement":
                        for (const clause of statement.cases)
                            if (clause.type === "SwitchCase")
                                statements(clause.consequent);
                        break;
                }
        };

        return {
            ArrayExpression(node) {
                for (const element of node.elements) check(element);
            },
            CallExpression(node) {
                const method = Nodes.member(node.callee)?.name;
                const callback =
                    method === "from"
                        ? node.arguments[1]
                        : method !== undefined && methods.includes(method)
                          ? node.arguments[0]
                          : undefined;
                if (
                    callback?.type !== "ArrowFunctionExpression" &&
                    callback?.type !== "FunctionExpression"
                )
                    return;
                if (callback.body?.type === "BlockStatement")
                    statements(callback.body.body);
                else check(callback.body);
            },
        };
    },
});
