import type { Css } from "@aljazmc/syntax";
import {
    compare,
    format,
    type SemanticRule,
    type Specificity,
    semantic,
    tail,
} from "../../analysis/css-semantic.js";
import { rule } from "../../rules.js";

/** At-rules whose rules cascade apart from the others. */
const independent = /^(?:container|media|scope|starting-style|supports)$/;

export default rule({
    name: "noDescendingSpecificity",
    group: "style",
    severity: "warn",
    recommended: true,
    fix: "none",
    languages: ["css"],
    create: (context) => ({
        CssStylesheet(sheet) {
            const contexts = new Map<
                string,
                Map<string, { range: Css.Selector; specificity: Specificity }>
            >();
            const descending = new Map<
                number,
                { node: Css.Selector; specificity: Specificity }
            >();
            const visit = (
                rules: SemanticRule[],
                atRule: string,
                layer: string,
            ) => {
                for (const semanticRule of rules) {
                    const node = semanticRule.node;
                    const key = `${atRule}|${layer}`;
                    const seen = contexts.get(key) ?? new Map();
                    contexts.set(key, seen);
                    for (const selector of semanticRule.selectors)
                        for (const resolved of selector.resolved) {
                            const text = resolved
                                .map((token) => token.text)
                                .join("");
                            if (text.includes("%") || text.includes("#{"))
                                continue;
                            const last = tail(resolved);
                            if (last === undefined) continue;
                            const before = seen.get(last);
                            if (!before) {
                                seen.set(last, {
                                    range: selector.node,
                                    specificity: selector.specificity,
                                });
                                continue;
                            }
                            if (
                                compare(
                                    before.specificity,
                                    selector.specificity,
                                ) > 0
                            ) {
                                if (!descending.has(selector.node.start))
                                    descending.set(selector.node.start, {
                                        node: selector.node,
                                        specificity: selector.specificity,
                                    });
                            } else if (
                                compare(
                                    selector.specificity,
                                    before.specificity,
                                ) > 0
                            )
                                seen.set(last, {
                                    range: selector.node,
                                    specificity: selector.specificity,
                                });
                        }
                    const childAtRule =
                        node.type === "AtRule" && independent.test(node.keyword)
                            ? String(node.start)
                            : atRule;
                    const childLayer =
                        node.type === "AtRule" && node.keyword === "layer"
                            ? String(node.start)
                            : layer;
                    visit(semanticRule.children, childAtRule, childLayer);
                }
            };
            visit(semantic(sheet, context.text), "", "");
            for (const { node, specificity } of [...descending.values()].sort(
                (a, b) => a.node.start - b.node.start,
            ))
                context.report(
                    node,
                    `Descending specificity selector found. This selector specificity is ${format(specificity)}`,
                );
        },
    }),
});
