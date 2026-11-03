import { compounds } from "../../analysis/css.js";
import { rule } from "../../rules.js";

/** Like Biome: `0`, `0n` and `0n + 0` never match, the zeros as written. */
const unmatchable = (value: string): boolean => {
    const compact = value.replace(/\s+/g, "");
    const number = /^[+-]?(\d+)$/.exec(compact);
    if (number) return number[1] === "0";
    const nth = /^[+-]?(\d*)[nN](?:[+-](\d+))?$/.exec(compact);
    if (!nth) return false;
    return nth[1] === "0" && (nth[2] === undefined || nth[2] === "0");
};

export default rule({
    name: "noUnmatchableAnbSelector",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["css"],
    create: (context) => ({
        CssRule(node) {
            if (!node.selectors) return;
            for (const { compound, pseudos } of compounds(node.selectors)) {
                // inside an odd number of `:not()`, matching nothing matches everything
                const nots = pseudos.filter(
                    (pseudo) => pseudo.name === "not",
                ).length;
                for (const child of compound.children) {
                    if (
                        child.type !== "PseudoClassSelector" ||
                        child.argument?.type !== "Nth"
                    )
                        continue;
                    if (nots % 2 === 1) continue;
                    if (unmatchable(child.argument.value))
                        context.report(
                            child.argument,
                            "This selector will never match any elements.",
                        );
                }
            }
        },
    }),
});
