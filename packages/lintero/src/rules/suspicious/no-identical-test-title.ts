import type { Node } from "@aljazmc/syntax";
import Tests, { type Kind } from "../../analysis/tests.js";
import { rule } from "../../rules.js";

/** The title as written, so `"a"`, `'a'` and `` `a` `` are the same. */
const title = (node: Node | undefined): string | undefined => {
    if (node?.type === "StringLiteral") return node.raw.slice(1, -1);
    if (node?.type === "TemplateLiteral" && node.expressions.length === 0)
        return node.quasis[0]?.raw;
};

export default rule({
    name: "noIdenticalTestTitle",
    group: "suspicious",
    severity: "warn",
    recommended: false,
    fix: "none",
    languages: ["js"],
    domains: { test: "recommended" },
    create: (context) => {
        /** Compares the tests and suites declared directly in a list of statements. */
        const check = (statements: Node[]) => {
            const seen: Record<Kind, Set<string>> = {
                describe: new Set(),
                test: new Set(),
            };
            for (const statement of statements) {
                if (statement.type !== "ExpressionStatement") continue;
                const call = statement.expression;
                if (call.type !== "CallExpression" || call.parenthesized)
                    continue;
                const kind = Tests.kind(call);
                const name = title(call.arguments[0]);
                // tables like test.each([...]) have titles per row
                if (
                    !kind ||
                    name === undefined ||
                    call.callee.type === "CallExpression"
                )
                    continue;
                if (seen[kind].has(name))
                    context.report(call, `Duplicate ${kind} title found.`);
                seen[kind].add(name);
            }
        };

        return {
            Program(node) {
                check(node.body);
            },
            CallExpression(node) {
                const callback = node.arguments[1];
                if (
                    Tests.kind(node) !== "describe" ||
                    node.callee.type === "CallExpression" ||
                    (callback?.type !== "ArrowFunctionExpression" &&
                        callback?.type !== "FunctionExpression")
                )
                    return;
                if (callback.body?.type === "BlockStatement")
                    check(callback.body.body);
            },
        };
    },
});
