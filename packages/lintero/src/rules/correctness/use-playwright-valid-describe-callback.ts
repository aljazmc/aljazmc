import Tests from "../../analysis/tests.js";
import { rule } from "../../rules.js";

export default rule({
    name: "usePlaywrightValidDescribeCallback",
    group: "correctness",
    severity: "error",
    recommended: false,
    fix: "none",
    languages: ["js"],
    domains: { playwright: "recommended" },
    create: (context) => ({
        CallExpression(node) {
            if (
                Tests.kind(node) !== "describe" ||
                node.callee.type === "CallExpression"
            )
                return;
            const callback = node.arguments[1];
            const message = !callback
                ? "Describe requires a callback function."
                : callback.type !== "ArrowFunctionExpression" &&
                    callback.type !== "FunctionExpression"
                  ? "Describe callback must be a function."
                  : callback.async
                    ? "Describe callback should not be async."
                    : callback.params.length > 0
                      ? "Describe callback should not have parameters."
                      : undefined;
            if (message) context.report(node, message);
        },
    }),
});
