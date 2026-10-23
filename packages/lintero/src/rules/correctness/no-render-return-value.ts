import React from "../../analysis/react.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noRenderReturnValue",
    group: "correctness",
    severity: "error",
    recommended: false,
    fix: "none",
    languages: ["js", "jsx"],
    domains: { react: "recommended" },
    create: (context) => ({
        CallExpression(node) {
            if (
                React.is(context, node.callee, "render", "react-dom") &&
                context.parent(node)?.type !== "ExpressionStatement"
            )
                context.report(
                    node,
                    "Do not depend on the value returned by the function ReactDOM.render().",
                );
        },
    }),
});
