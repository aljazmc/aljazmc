import {
    normalize,
    type SemanticRule,
    semantic,
} from "../../analysis/css-semantic.js";
import { rule } from "../../rules.js";

/** At-rules whose rules are apart from the others. */
const independent = /^(?:container|media|scope|starting-style|supports)$/;

export default rule({
    name: "noDuplicateSelectors",
    group: "suspicious",
    severity: "warn",
    recommended: false,
    fix: "none",
    languages: ["css"],
    create: (context) => ({
        CssStylesheet(sheet) {
            const seen = new Set<string>();
            const visit = (rules: SemanticRule[], scope: string) => {
                for (const semanticRule of rules) {
                    const node = semanticRule.node;
                    if (node.type === "AtRule") {
                        visit(
                            semanticRule.children,
                            independent.test(node.keyword)
                                ? `${scope}/${node.start}`
                                : scope,
                        );
                        continue;
                    }
                    const resolved = semanticRule.selectors.flatMap(
                        (selector) => selector.resolved,
                    );
                    if (resolved.length > 0) {
                        const texts = resolved.map((tokens) =>
                            tokens.map((token) => token.text).join(""),
                        );
                        if (
                            !texts.some(
                                (text) =>
                                    text.includes("%") || text.includes("#{"),
                            )
                        ) {
                            const list = resolved
                                .map(normalize)
                                .sort()
                                .join(", ");
                            const key = `${scope}\u0000${list}`;
                            if (seen.has(key))
                                context.report(
                                    node,
                                    `Duplicate selector list "${list}".`,
                                );
                            else seen.add(key);
                        }
                    }
                    visit(semanticRule.children, scope);
                }
            };
            visit(semantic(sheet, context.text), "");
        },
    }),
});
