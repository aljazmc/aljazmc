import type { Node } from "@aljazmc/syntax";
import { Walker } from "@aljazmc/syntax";
import Flow from "../../analysis/flow.js";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

const returning = new Set([
    "every",
    "filter",
    "find",
    "findIndex",
    "findLast",
    "findLastIndex",
    "flatMap",
    "map",
    "reduce",
    "reduceRight",
    "some",
    "sort",
    "toSorted",
]);

/** Return statements of a function, not of the functions inside it. */
const returns = (node: Node): NodeOfReturn[] =>
    Walker.children(node).flatMap((child) => {
        if (Nodes.isFunction(child) || child.type === "ClassBody") return [];
        if (child.type === "ReturnStatement")
            return [child as NodeOfReturn, ...returns(child)];
        return returns(child);
    });

type NodeOfReturn = Node & { type: "ReturnStatement"; argument: Node | null };

/** Whether a value is `undefined` in disguise, like `void x`. */
const nothing = (node: Node | null): boolean =>
    !node ||
    (node.type === "UnaryExpression" && node.operator === "void") ||
    (node.type === "Identifier" && node.name === "undefined");

export default rule<{ checkForEach: boolean; allowImplicit: boolean }>({
    name: "useIterableCallbackReturn",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    options: { checkForEach: true, allowImplicit: false },
    create: (context) => ({
        CallExpression(node) {
            const callee = Nodes.unwrap(node.callee);
            if (callee.type !== "MemberExpression") return;
            const method = Nodes.key(callee.property, callee.computed) ?? "";
            const from =
                method === "from" &&
                callee.object.type === "Identifier" &&
                callee.object.name === "Array" &&
                context.semantic.isGlobal(callee.object);
            const callback = node.arguments[from ? 1 : 0];
            if (
                !callback ||
                (callback.type !== "ArrowFunctionExpression" &&
                    callback.type !== "FunctionExpression") ||
                callback.async ||
                callback.generator ||
                !callback.body
            )
                return;
            const body = callback.body;
            const name = from
                ? "Array.from() method"
                : `${method}() iterable method`;

            if (method === "forEach" && context.options.checkForEach) {
                const value =
                    body.type !== "BlockStatement"
                        ? !nothing(body)
                        : returns(body).some(
                              ({ argument }) => !nothing(argument),
                          );
                if (value)
                    context.report(
                        callee.property,
                        `This callback passed to ${name} should not return a value.`,
                    );
                return;
            }

            if (!from && !returning.has(method)) return;
            if (body.type !== "BlockStatement") return;
            const missing =
                Flow.completions(body).has("normal") ||
                (!context.options.allowImplicit &&
                    returns(body).some(({ argument }) => !argument));
            if (missing)
                context.report(
                    callee.property,
                    `This callback passed to ${name} should always return a value.`,
                );
        },
    }),
});
