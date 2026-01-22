import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

const kinds: [RegExp, string][] = [
    [/n$/, "Bigint is not allowed here."],
    [/^0[xX]/, "Hexadecimal number literal is not allowed here."],
    [/^0[oO]/, "Octal number literal is not allowed here."],
    [/^0[bB]/, "Binary number literal is not allowed here."],
    [/_/, "Number literal with underscore is not allowed here."],
];

export default rule({
    name: "useSimpleNumberKeys",
    group: "complexity",
    severity: "warn",
    recommended: true,
    fix: "safe",
    languages: ["js"],
    create: (context) => ({
        Property(node) {
            const { key } = node;
            if (node.computed || key.type !== "NumericLiteral") return;
            const message = kinds.find(([pattern]) =>
                pattern.test(key.raw),
            )?.[1];
            if (!message) return;
            context.report(key, message, {
                message: "Replace it with a base 10 number literal.",
                edits: [
                    {
                        start: key.start,
                        end: key.end,
                        text: String(Nodes.number(key.raw)),
                    },
                ],
            });
        },
    }),
});
