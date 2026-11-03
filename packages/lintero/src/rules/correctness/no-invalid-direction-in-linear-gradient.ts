import { values } from "../../analysis/css.js";
import { rule } from "../../rules.js";

const gradients = /^(?:-webkit-|-moz-|-o-|-ms-)?linear-gradient$/i;
const direction = /^(top|left|bottom|right)(?: (top|left|bottom|right))?$/i;

/** Like Biome: a side, or two different sides, after `to`, or without `to` when vendor prefixed. */
const standard = (text: string, prefixed: boolean): boolean => {
    let match: RegExpExecArray | null = null;
    if (prefixed && !text.startsWith("to ")) match = direction.exec(text);
    else if (!prefixed && text.startsWith("to "))
        match = direction.exec(text.slice(3));
    if (!match) return false;
    return match[2] === undefined || match[1] !== match[2];
};

export default rule({
    name: "noInvalidDirectionInLinearGradient",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["css"],
    create: (context) => ({
        CssDeclaration(node) {
            for (const value of values(node.value)) {
                if (value.type !== "Function" || !gradients.test(value.name))
                    continue;
                const comma = value.children.findIndex(
                    (child) => child.type === "Comma",
                );
                const first = value.children.slice(
                    0,
                    comma < 0 ? undefined : comma,
                );
                const start = first[0];
                const end = first.at(-1);
                if (!start || !end) continue;
                const range = { start: start.start, end: end.end };
                const text = context.slice(range);
                if (/\bin\b/i.test(text)) continue;
                if (/^\d/.test(text)) {
                    if (!/^[\d.]+(?:deg|grad|rad|turn)$/.test(text))
                        context.report(
                            range,
                            "Unexpected nonstandard direction",
                        );
                    continue;
                }
                if (!/top|left|bottom|right/.test(text.toLowerCase())) continue;
                if (!standard(text, /^-(?:webkit|moz|ms|o)-/.test(value.name)))
                    context.report(range, "Unexpected nonstandard direction");
            }
        },
    }),
});
