import { values } from "../../analysis/css.js";
import { FUNCTION_KEYWORDS } from "../../analysis/css-keywords.js";
import { rule } from "../../rules.js";

const known = new Set(FUNCTION_KEYWORDS);

export default rule<{ ignore?: string[] }>({
    name: "noUnknownFunction",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["css"],
    options: { ignore: [] },
    create: (context) => ({
        CssDeclaration(node) {
            for (const value of values(node.value)) {
                if (value.type !== "Function") continue;
                // like Biome, `module.function()` is SCSS, not a CSS function
                if (context.text[value.start - 1] === ".") continue;
                const name = value.name;
                // `if()` is its own syntax, custom functions start with `--`
                if (
                    name.startsWith("--") ||
                    known.has(name.toLowerCase()) ||
                    /^if$/i.test(name)
                )
                    continue;
                if (
                    (context.options.ignore ?? []).some(
                        (ignore) => ignore.toLowerCase() === name.toLowerCase(),
                    )
                )
                    continue;
                context.report(
                    { start: value.start, end: value.start + name.length },
                    `Unexpected unknown function: ${name}`,
                );
            }
        },
    }),
});
