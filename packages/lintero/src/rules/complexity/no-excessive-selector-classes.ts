import type { Css } from "@aljazmc/syntax";
import { compounds } from "../../analysis/css.js";
import { rule } from "../../rules.js";

export default rule<{ maxClasses?: number }>({
    name: "noExcessiveSelectorClasses",
    group: "complexity",
    severity: "info",
    recommended: false,
    fix: "none",
    languages: ["css"],
    create: (context) => ({
        CssRule(node) {
            const max = context.options.maxClasses;
            if (max === undefined || !node.selectors) return;
            for (const selector of node.selectors.children) {
                const list: Css.SelectorList = {
                    type: "SelectorList",
                    start: selector.start,
                    end: selector.end,
                    children: [selector],
                };
                let count = 0;
                for (const { compound } of compounds(list))
                    count += compound.children.filter(
                        (child) => child.type === "ClassSelector",
                    ).length;
                if (count <= max) continue;
                // a combinator before a nested selector is not part of it
                const first = selector.children[0] as Css.CompoundSelector;
                const start =
                    first.element?.start ??
                    first.children[0]?.start ??
                    selector.start;
                context.report(
                    { start, end: selector.end },
                    `Expected this selector to have no more than ${max} class ${max === 1 ? "selector" : "selectors"}, but found ${count}.`,
                );
            }
        },
    }),
});
