import type { Node } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

export default rule({
    name: "noFocusedTests",
    group: "suspicious",
    severity: "warn",
    recommended: false,
    fix: "unsafe",
    languages: ["js"],
    domains: { test: "recommended" },
    create: (context) => ({
        CallExpression(node) {
            let callee: Node = node.callee;
            // test.only.each([...])
            if (
                callee.type === "MemberExpression" &&
                !callee.computed &&
                callee.property.type === "Identifier" &&
                callee.property.name === "each"
            )
                callee = callee.object;

            if (
                callee.type === "Identifier" &&
                ["fdescribe", "fit"].includes(callee.name)
            ) {
                context.report(callee, "Don't focus the test.", {
                    message: "Remove focus from test.",
                    edits: [
                        {
                            start: callee.start,
                            end: callee.start + 1,
                            text: "",
                        },
                    ],
                });
                return;
            }
            if (
                callee.type !== "MemberExpression" ||
                callee.computed ||
                callee.property.type !== "Identifier" ||
                callee.property.name !== "only" ||
                callee.object.type !== "Identifier" ||
                !["describe", "it", "test"].includes(callee.object.name)
            )
                return;
            context.report(callee.property, "Don't focus the test.", {
                message: "Remove focus from test.",
                edits: [
                    {
                        start: callee.object.end,
                        end: callee.property.end,
                        text: "",
                    },
                ],
            });
        },
    }),
});
