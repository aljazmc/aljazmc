import type { Css } from "@aljazmc/syntax";
import { decode } from "../../analysis/css.js";
import { rule } from "../../rules.js";

/** The names of a layer prelude, each a list of its dotted parts. */
const names = (prelude: readonly Css.Value[]): Css.Identifier[][] => {
    const result: Css.Identifier[][] = [[]];
    for (const value of prelude)
        if (value.type === "Comma") result.push([]);
        else if (value.type === "Identifier")
            (result.at(-1) as Css.Identifier[]).push(value);
    return result.filter((name) => name.length > 0);
};

export default rule({
    name: "noSelfNestedLayer",
    group: "nursery",
    severity: "warn",
    recommended: false,
    fix: "none",
    languages: ["css"],
    create: (context) => ({
        CssAtRule(node) {
            if (node.keyword !== "layer") return;
            const enclosing: Css.Identifier[][] = [];
            for (const ancestor of context.cssAncestors(node)) {
                if (
                    ancestor.type !== "AtRule" ||
                    ancestor.keyword !== "layer" ||
                    !ancestor.block
                )
                    continue;
                const list = names(ancestor.prelude);
                if (list.length === 1)
                    enclosing.push(list[0] as Css.Identifier[]);
            }
            for (const name of names(node.prelude)) {
                const repeated = enclosing.find(
                    (outer) =>
                        outer.length <= name.length &&
                        outer.every(
                            (part, index) =>
                                decode(part.value) ===
                                decode((name[index] as Css.Identifier).value),
                        ),
                );
                if (repeated) {
                    context.report(
                        {
                            start: (name[0] as Css.Identifier).start,
                            end: (name.at(-1) as Css.Identifier).end,
                        },
                        "This layer repeats the name of an enclosing layer.",
                    );
                    return;
                }
            }
        },
    }),
});
