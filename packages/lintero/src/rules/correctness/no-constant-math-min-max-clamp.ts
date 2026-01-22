import type { Node } from "@aljazmc/syntax";
import type Context from "../../analysis/context.js";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

/** `min` or `max` of a global Math call, with its constant and its other argument. */
const clamp = (
    context: Context,
    node: Node,
): { method: string; constant: Node; other: Node } | undefined => {
    if (node.type !== "CallExpression" || node.arguments.length !== 2) return;
    const callee = Nodes.unwrap(node.callee);
    const path = Nodes.path(callee);
    if (path !== "Math.min" && path !== "Math.max") return;
    if (
        callee.type !== "MemberExpression" ||
        !context.semantic.isGlobal(callee.object)
    )
        return;
    const [first, second] = node.arguments as [Node, Node];
    const method = path.slice(5);
    if (first.type === "NumericLiteral")
        return { method, constant: first, other: second };
    if (second.type === "NumericLiteral")
        return { method, constant: second, other: first };
};

export default rule({
    name: "noConstantMathMinMaxClamp",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    create: (context) => ({
        CallExpression(node) {
            const outer = clamp(context, node);
            const inner = outer && clamp(context, Nodes.unwrap(outer.other));
            if (!outer || !inner || inner.method === outer.method) return;

            const outerValue = Nodes.number(context.slice(outer.constant));
            const innerValue = Nodes.number(context.slice(inner.constant));
            const constant =
                outer.method === "min"
                    ? outerValue < innerValue
                    : outerValue > innerValue;
            if (!constant) return;

            context.report(
                node,
                "This Math.min/Math.max combination leads to a constant result.",
                {
                    message: "Swap the constants.",
                    edits: [
                        {
                            ...{
                                start: outer.constant.start,
                                end: outer.constant.end,
                            },
                            text: context.slice(inner.constant),
                        },
                        {
                            ...{
                                start: inner.constant.start,
                                end: inner.constant.end,
                            },
                            text: context.slice(outer.constant),
                        },
                    ],
                },
            );
        },
    }),
});
