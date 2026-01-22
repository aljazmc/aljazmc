import type { Node } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

/** The pattern of a string as the body of a regular expression literal. */
const literal = (pattern: string): string => {
    const escapes: Record<string, string> = {
        "/": "\\/",
        "\n": "\\n",
        "\r": "\\r",
        "\u2028": "\\u2028",
        "\u2029": "\\u2029",
    };
    let body = "";
    for (let index = 0; index < pattern.length; index++) {
        const char = pattern[index] as string;
        if (char === "\\") body += char + (pattern[++index] ?? "");
        else body += escapes[char] ?? char;
    }
    return body || "(?:)";
};

export default rule({
    name: "useRegexLiterals",
    group: "complexity",
    severity: "warn",
    recommended: true,
    fix: "safe",
    languages: ["js"],
    create: (context) => {
        const check = (node: Node, callee: Node, args: Node[]) => {
            const target = Nodes.unwrap(callee);
            const path = Nodes.path(target);
            if (
                path !== "RegExp" &&
                path !== "globalThis.RegExp" &&
                path !== "window.RegExp"
            )
                return;
            const root =
                target.type === "MemberExpression" ? target.object : target;
            if (!context.semantic.isGlobal(root)) return;

            const [first, second] = args;
            const pattern = Nodes.string(first);
            const flags = second ? Nodes.string(second) : "";
            if (args.length > 2 || pattern === undefined || flags === undefined)
                return;
            try {
                new RegExp(pattern, flags);
            } catch {
                return;
            }

            context.report(
                node,
                "Use a regular expression literal instead of the RegExp constructor.",
                {
                    message: "Use a literal notation instead.",
                    edits: [
                        {
                            start: node.start,
                            end: node.end,
                            text: `/${literal(pattern)}/${flags}`,
                        },
                    ],
                },
            );
        };
        return {
            NewExpression(node) {
                check(node, node.callee, node.arguments);
            },
            CallExpression(node) {
                check(node, node.callee, node.arguments);
            },
        };
    },
});
