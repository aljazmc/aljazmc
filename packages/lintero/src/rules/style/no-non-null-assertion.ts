import { rule } from "../../rules.js";

export default rule({
    name: "noNonNullAssertion",
    group: "style",
    severity: "warn",
    recommended: true,
    fix: "unsafe",
    languages: ["ts"],
    create: (context) => ({
        TSNonNullExpression(node) {
            // `a!!` is reported once
            if (node.expression.type === "TSNonNullExpression") return;
            const parent = context.parent(node);
            const member =
                parent?.type === "MemberExpression" &&
                parent.object === node &&
                !node.parenthesized;
            const bang = context.find("!", node.expression.end, node.end);
            context.report(
                node,
                "Forbidden non-null assertion.",
                member
                    ? {
                          message:
                              "Replace with optional chain operator ?. This operator includes runtime checks, so it is safer than the compile-only non-null assertion operator.",
                          edits: [
                              { ...bang, text: parent.computed ? "?." : "?" },
                          ],
                      }
                    : undefined,
            );
        },
    }),
});
