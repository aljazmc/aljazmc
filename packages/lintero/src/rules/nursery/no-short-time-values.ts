import { values } from "../../analysis/css.js";
import { rule } from "../../rules.js";

const properties = new Set([
    "animation",
    "animation-delay",
    "animation-duration",
    "transition",
    "transition-delay",
    "transition-duration",
]);

export default rule<{ minimum?: number }>({
    name: "noShortTimeValues",
    group: "nursery",
    severity: "info",
    recommended: false,
    fix: "none",
    languages: ["css"],
    create: (context) => ({
        CssDeclaration(node) {
            const minimum = context.options.minimum;
            if (minimum === undefined) return;
            const name = node.property
                .toLowerCase()
                .replace(/^-(?:moz|ms|o|webkit)-/, "");
            if (!properties.has(name)) return;
            for (const value of values(node.value)) {
                if (value.type !== "Dimension") continue;
                const unit = value.unit.toLowerCase();
                const per = unit === "ms" ? 1 : unit === "s" ? 1000 : 0;
                if (per === 0) continue;
                const number = Number(value.value);
                if (!(number > 0) || number >= minimum / per) continue;
                context.report(
                    value,
                    `This time is shorter than the configured minimum of ${minimum}ms.`,
                );
            }
        },
    }),
});
