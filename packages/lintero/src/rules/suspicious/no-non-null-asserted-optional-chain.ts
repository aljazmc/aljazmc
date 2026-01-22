import type { Node } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

/** Whether an expression ends an optional chain, like `a?.b` or `a?.b.c()`. */
const optionalChain = (node: Node): boolean => {
    let current = node;
    for (;;) {
        if (current.parenthesized) return false;
        if (current.type === "MemberExpression") {
            if (current.optional) return true;
            current = current.object;
        } else if (current.type === "CallExpression") {
            if (current.optional) return true;
            current = current.callee;
        } else return false;
    }
};

export default rule({
    name: "noNonNullAssertedOptionalChain",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["ts"],
    create: (context) => ({
        TSNonNullExpression(node) {
            if (optionalChain(node.expression))
                context.report(
                    node,
                    "Forbidden non-null assertion after optional chaining.",
                );
        },
    }),
});
