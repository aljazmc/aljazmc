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
            // The callback is the last argument: `describe(title, callback)`,
            // `describe(title, details, callback)` or `describe(callback)`.
            const callback = node.arguments.at(-1);
            const isFunction =
                callback?.type === "ArrowFunctionExpression" ||
                callback?.type === "FunctionExpression";
            const message =
                !callback || (node.arguments.length === 1 && !isFunction)
                    ? "Describe requires a callback function."
                    : !isFunction
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
