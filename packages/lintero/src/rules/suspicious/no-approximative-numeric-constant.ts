import { rule } from "../../rules.js";

const constants: [string, number][] = [
    ["E", Math.E],
    ["LN10", Math.LN10],
    ["LN2", Math.LN2],
    ["LOG10E", Math.LOG10E],
    ["LOG2E", Math.LOG2E],
    ["PI", Math.PI],
    ["SQRT1_2", Math.SQRT1_2],
    ["SQRT2", Math.SQRT2],
];

/** The Math constant a literal with at least three decimals truncates or rounds. */
const approximated = (raw: string): string | undefined => {
    const text = raw.replace(/_/g, "");
    const decimals = /^\d+\.(\d+)$/.exec(text)?.[1];
    if (!decimals || decimals.length < 3) return;
    return constants.find(
        ([, value]) =>
            String(value).startsWith(text) ||
            value.toFixed(decimals.length) === text,
    )?.[0];
};

export default rule({
    name: "noApproximativeNumericConstant",
    group: "suspicious",
    severity: "warn",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    create: (context) => ({
        NumericLiteral(node) {
            const name = approximated(node.raw);
            if (!name) return;
            context.report(
                node,
                "Prefer constants from the standard library.",
                {
                    message: `Use Math.${name} instead.`,
                    edits: [
                        {
                            start: node.start,
                            end: node.end,
                            text: `Math.${name}`,
                        },
                    ],
                },
            );
        },
    }),
});
