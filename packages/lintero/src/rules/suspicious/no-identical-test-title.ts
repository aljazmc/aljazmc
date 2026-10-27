import type { Node } from "@aljazmc/syntax";
import Tests, { type Kind } from "../../analysis/tests.js";
import { rule } from "../../rules.js";

/** The title as written, so `"a"`, `'a'` and `` `a` `` are the same, `` ` ` `` has none. */
const title = (node: Node | undefined): string | undefined => {
    if (node?.type === "StringLiteral") return node.raw.slice(1, -1);
    if (node?.type === "TemplateLiteral" && node.expressions.length === 0)
        return node.quasis[0]?.raw || undefined;
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
            // the first title node of each title, and whether it repeats
            const seen: Record<Kind, Map<string, [Node, boolean]>> = {
                describe: new Map(),
                test: new Map(),
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
                const first = seen[kind].get(name);
                if (first) first[1] = true;
                else seen[kind].set(name, [call.arguments[0] as Node, false]);
            }
            // one report per repeated title, on its first occurrence
            for (const kind of ["describe", "test"] as const)
                for (const [name, [node, repeated]] of seen[kind])
                    if (repeated)
                        context.report(
                            node,
                            `The ${kind} title "${name}" is used more than once in the same scope.`,
                        );
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
