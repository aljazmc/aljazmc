import Tests from "../../analysis/tests.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noDuplicateTestHooks",
    group: "suspicious",
    severity: "error",
    recommended: false,
    fix: "none",
    languages: ["js"],
    domains: { test: "recommended" },
    create: (context) => {
        // the hooks of each enclosing describe block
        const suites: Set<string>[] = [];
        return {
            CallExpression(node) {
                const hook = Tests.hook(node);
                const suite = suites.at(-1);
                if (hook && suite) {
                    if (suite.has(hook))
                        context.report(node, `Duplicate ${hook} hook found.`);
                    suite.add(hook);
                }
                if (Tests.kind(node) === "describe") suites.push(new Set());
            },
            "CallExpression:exit"(node) {
                if (Tests.kind(node) === "describe") suites.pop();
            },
        };
    },
});
