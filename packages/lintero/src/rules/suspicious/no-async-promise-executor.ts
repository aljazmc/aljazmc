import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noAsyncPromiseExecutor",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        NewExpression(node) {
            const [executor] = node.arguments;
            if (
                node.callee.type !== "Identifier" ||
                node.callee.name !== "Promise" ||
                !executor
            )
                return;
            const fn = Nodes.unwrap(executor);
            if (
                (fn.type === "FunctionExpression" ||
                    fn.type === "ArrowFunctionExpression") &&
                fn.async
            )
                context.report(
                    fn,
                    "Promise executor functions should not be `async`.",
                );
        },
    }),
});
