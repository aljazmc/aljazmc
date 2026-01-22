import type { Node } from "@aljazmc/syntax";
import { Walker } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";
import { returned } from "./no-flat-map-identity.js";

const replacements = new Map([
    ["findIndex", "indexOf"],
    ["findLastIndex", "lastIndexOf"],
]);

/** Whether a node mentions a name, or the function's own `arguments` and `this`. */
const mentions = (node: Node, name: string): boolean =>
    (node.type === "Identifier" &&
        (node.name === name || node.name === "arguments")) ||
    node.type === "ThisExpression" ||
    Walker.children(node).some((child) => mentions(child, name));

export default rule({
    name: "useIndexOf",
    group: "complexity",
    severity: "info",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    create: (context) => ({
        CallExpression(node) {
            const callee = Nodes.unwrap(node.callee);
            if (callee.type !== "MemberExpression") return;
            const method = Nodes.key(callee.property, callee.computed) ?? "";
            const replacement = replacements.get(method);
            const [callback] = node.arguments;
            if (!replacement || node.arguments.length !== 1 || !callback)
                return;
            if (
                callback.type !== "ArrowFunctionExpression" &&
                callback.type !== "FunctionExpression"
            )
                return;

            const [parameter] = callback.params;
            const test = returned(callback);
            if (
                callback.params.length !== 1 ||
                parameter?.type !== "Identifier" ||
                test?.type !== "BinaryExpression" ||
                test.operator !== "==="
            )
                return;

            const { left, right } = test;
            const isParameter = (side: Node) =>
                side.type === "Identifier" && side.name === parameter.name;
            const value = isParameter(left)
                ? right
                : isParameter(right)
                  ? left
                  : undefined;
            if (!value || !Nodes.pure(value) || mentions(value, parameter.name))
                return;

            context.report(
                node,
                `Prefer Array#${replacement}() over Array#${method}() when looking for the index of an item.`,
                {
                    message: `Replace Array#${method}() with Array#${replacement}()`,
                    edits: [
                        {
                            start: callee.property.start,
                            end: callee.property.end,
                            text: replacement,
                        },
                        {
                            start: callback.start,
                            end: callback.end,
                            text: context.slice(value),
                        },
                    ],
                },
            );
        },
    }),
});
