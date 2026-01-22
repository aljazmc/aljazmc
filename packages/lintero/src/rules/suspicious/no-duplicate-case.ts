import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noDuplicateCase",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        SwitchStatement(node) {
            const tests = node.cases.flatMap((clause) => clause.test ?? []);
            for (const [index, test] of tests.entries())
                if (
                    tests
                        .slice(0, index)
                        .some((other) => Nodes.same(other, test))
                )
                    context.report(test, "Duplicate case label.");
        },
    }),
});
