import Vue from "../../analysis/vue.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noVueDataObjectDeclaration",
    group: "correctness",
    severity: "error",
    recommended: false,
    fix: "safe",
    languages: ["js"],
    domains: { vue: "recommended" },
    create: (context) => ({
        CallExpression(node) {
            const options = Vue.component(context, node);
            const data = options && Vue.option(options, "data");
            if (data?.value.type !== "ObjectExpression") return;
            context.report(
                data,
                "Found an object declaration for `data` in this component.",
                {
                    message:
                        "Refactor the data object into a function returning the data object",
                    edits: [
                        {
                            start: data.value.start,
                            end: data.value.start,
                            text: "() => (",
                        },
                        {
                            start: data.value.end,
                            end: data.value.end,
                            text: ")",
                        },
                    ],
                },
            );
        },
    }),
});
