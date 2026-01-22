import type { Node } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import type { Fix } from "../../rules.js";
import { rule } from "../../rules.js";

const cases = new Map<string, (text: string) => string>([
    ["toUpperCase", (text) => text.toUpperCase()],
    ["toLowerCase", (text) => text.toLowerCase()],
]);

/** The case a call like `s.toUpperCase()` gives its string. */
const caseOf = (node: Node): ((text: string) => string) | undefined => {
    const call = Nodes.unwrap(node);
    if (call.type !== "CallExpression" || call.arguments.length > 0) return;
    const member = Nodes.member(call.callee);
    return member && cases.get(member.name);
};

export default rule({
    name: "noStringCaseMismatch",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    create: (context) => {
        /** The literal compared with a changed case, when it can never be equal. */
        const mismatch = (call: Node, literal: Node): Fix | undefined => {
            const change = caseOf(call);
            const value = Nodes.string(literal);
            if (!change || value === undefined || change(value) === value)
                return;
            const quote = context.text[literal.start] ?? '"';
            return {
                message: "Use the same case for the literal.",
                edits: [
                    {
                        start: literal.start,
                        end: literal.end,
                        text: `${quote}${change(value)}${quote}`,
                    },
                ],
            };
        };
        return {
            BinaryExpression(node) {
                if (node.operator !== "==" && node.operator !== "===") return;
                const fix =
                    mismatch(node.left, node.right) ??
                    mismatch(node.right, node.left);
                if (fix)
                    context.report(
                        node,
                        "This expression always returns false.",
                        fix,
                    );
            },
            SwitchStatement(node) {
                for (const { test } of node.cases) {
                    const fix = test && mismatch(node.discriminant, test);
                    if (fix && test)
                        context.report(
                            test,
                            "This case will never match.",
                            fix,
                        );
                }
            },
        };
    },
});
