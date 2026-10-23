import { rule } from "../../rules.js";

export default rule({
    name: "useQwikClasslist",
    group: "correctness",
    severity: "error",
    recommended: false,
    fix: "none",
    languages: ["jsx"],
    domains: { qwik: "recommended" },
    create: (context) => ({
        JSXAttribute(node) {
            if (node.name !== "class" && node.name !== "className") return;
            const call =
                node.value?.type === "JSXExpressionContainer"
                    ? node.value.expression
                    : null;
            if (
                call?.type === "CallExpression" &&
                call.callee.type === "Identifier" &&
                call.callee.name === "classnames"
            )
                context.report(
                    node,
                    "Avoid third-party classnames utilities with Qwik components",
                );
        },
    }),
});
