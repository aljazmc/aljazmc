import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

export default rule({
    name: "useParseIntRadix",
    group: "correctness",
    severity: "info",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    create: (context) => ({
        CallExpression(node) {
            const callee = Nodes.unwrap(node.callee);
            const path = Nodes.path(callee);
            if (path !== "parseInt" && path !== "Number.parseInt") return;
            let root = callee;
            while (root.type === "MemberExpression")
                root = Nodes.unwrap(root.object);
            if (!context.semantic.isGlobal(root)) return;

            const [, radix] = node.arguments;
            if (node.arguments.length === 0)
                context.report(
                    node,
                    "This call to parseInt has no arguments, it will always return NaN",
                );
            else if (!radix)
                context.report(node, "Missing radix parameter", {
                    message: "Add a radix of 10.",
                    edits: [
                        {
                            start: (node.arguments[0] as { end: number }).end,
                            end: (node.arguments[0] as { end: number }).end,
                            text: ", 10",
                        },
                    ],
                });
            else {
                const value = Nodes.unwrap(radix);
                const valid =
                    value.type === "NumericLiteral"
                        ? Number.isInteger(Nodes.number(value.raw)) &&
                          Nodes.number(value.raw) >= 2 &&
                          Nodes.number(value.raw) <= 36
                        : ![
                              "StringLiteral",
                              "BooleanLiteral",
                              "NullLiteral",
                              "TemplateLiteral",
                              "RegExpLiteral",
                              "ObjectExpression",
                              "ArrayExpression",
                              "ArrowFunctionExpression",
                              "FunctionExpression",
                          ].includes(value.type) &&
                          !(
                              value.type === "Identifier" &&
                              value.name === "undefined"
                          );
                if (!valid) context.report(node, "Invalid radix parameter");
            }
        },
    }),
});
