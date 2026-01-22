import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

const literals: Record<
    number,
    { name: string; prefix: string; digits: RegExp }
> = {
    2: { name: "a binary", prefix: "0b", digits: /^-?[01]+$/ },
    8: { name: "an octal", prefix: "0o", digits: /^-?[0-7]+$/ },
    16: { name: "a hexadecimal", prefix: "0x", digits: /^-?[0-9a-f]+$/i },
};

export default rule({
    name: "useNumericLiterals",
    group: "complexity",
    severity: "warn",
    recommended: true,
    fix: "safe",
    languages: ["js"],
    create: (context) => ({
        CallExpression(node) {
            const callee = Nodes.unwrap(node.callee);
            const path = Nodes.path(callee);
            if (path !== "parseInt" && path !== "Number.parseInt") return;
            const root =
                callee.type === "MemberExpression" ? callee.object : callee;
            if (!context.semantic.isGlobal(root)) return;

            const [text, radix] = node.arguments;
            const value = Nodes.string(text);
            if (
                node.arguments.length !== 2 ||
                value === undefined ||
                radix?.type !== "NumericLiteral"
            )
                return;
            const literal = literals[Nodes.number(radix.raw)];
            if (!literal?.digits.test(value)) return;

            const sign = value.startsWith("-") ? "-" : "";
            context.report(
                node,
                `This call to ${path}() can be replaced by ${literal.name} literal.`,
                {
                    message: "Use the computed literal instead.",
                    edits: [
                        {
                            start: node.start,
                            end: node.end,
                            text: `${sign}${literal.prefix}${value.replace(/^-/, "")}`,
                        },
                    ],
                },
            );
        },
    }),
});
