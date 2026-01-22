import Flow from "../../analysis/flow.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noFallthroughSwitchClause",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        SwitchStatement(node) {
            // like Biome, comments like `// falls through` are no exception
            for (const clause of node.cases.slice(0, -1))
                if (
                    clause.consequent.length > 0 &&
                    Flow.list(clause.consequent).has("normal")
                )
                    context.report(
                        clause,
                        "This case is falling through to the next case.",
                    );
        },
    }),
});
