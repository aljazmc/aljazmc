import type { Css } from "@aljazmc/syntax";
import { compounds, values } from "../../analysis/css.js";
import {
    BASELINE_AT_RULES,
    BASELINE_FUNCTIONS,
    BASELINE_MEDIA_CONDITIONS,
    BASELINE_PROPERTIES,
    BASELINE_PROPERTY_VALUES,
    BASELINE_SELECTORS,
    type Baseline,
} from "../../analysis/css-baseline.js";
import { COLOR_KEYWORDS } from "../../analysis/css-keywords.js";
import { rule } from "../../rules.js";

const colors = new Set(COLOR_KEYWORDS);

/** At-rules Biome checks, by the names it knows. */
const atRules = new Set(
    "charset color-profile container counter-style document font-face font-feature-values font-palette-values import keyframes layer media namespace page position-try property scope starting-style supports view-transition function custom-media".split(
        " ",
    ),
);

interface Options {
    /** `widely` or `newly` available, or newly available by the end of a year. */
    available?: "widely" | "newly" | number;
    allowProperties?: string[];
    allowPropertyValues?: Record<string, string[]>;
    allowFunctions?: string[];
    allowSelectors?: string[];
    allowMediaConditions?: string[];
    allowAtRules?: string[];
}

export default rule<Options>({
    name: "useBaseline",
    group: "suspicious",
    severity: "warn",
    recommended: false,
    fix: "none",
    languages: ["css"],
    options: { available: "widely" },
    create: (context) => {
        const acceptable = ({ tier, year }: Baseline): boolean => {
            const available = context.options.available ?? "widely";
            if (available === "widely") return tier === "widely";
            if (available === "newly") return tier !== "limited";
            if (tier === "widely") return true;
            return tier === "newly" && year !== null && year <= available;
        };
        const allowed = (list: string[] | undefined, name: string) =>
            (list ?? []).some(
                (item) => item.toLowerCase() === name.toLowerCase(),
            );
        const check = (
            table: Map<string, Baseline>,
            name: string,
            range: { start: number; end: number },
            category: string,
            message = name,
        ) => {
            const status = table.get(name.toLowerCase());
            if (status && !acceptable(status))
                context.report(
                    range,
                    `CSS ${category} ${message} isn't part of the chosen Baseline.`,
                );
        };
        const functions = (list: readonly Css.Value[]) => {
            for (const value of values(list)) {
                if (value.type !== "Function" || value.name.startsWith("--"))
                    continue;
                if (allowed(context.options.allowFunctions, value.name))
                    continue;
                check(
                    BASELINE_FUNCTIONS,
                    value.name,
                    {
                        start: value.start,
                        end: value.start + value.name.length,
                    },
                    "function",
                );
            }
        };
        return {
            CssDeclaration(node) {
                functions(node.value);
                // inside `@supports`, a feature is used when it is supported, not inside `@supports not`
                for (const ancestor of context.cssAncestors(node))
                    if (
                        ancestor.type === "AtRule" &&
                        ancestor.keyword === "supports"
                    ) {
                        const first = ancestor.prelude[0];
                        if (
                            !(
                                first?.type === "Identifier" &&
                                /^not$/i.test(first.value)
                            )
                        )
                            return;
                        break;
                    }
                const name = node.property;
                if (
                    name.startsWith("--") ||
                    allowed(context.options.allowProperties, name)
                )
                    return;
                const status = BASELINE_PROPERTIES.get(name.toLowerCase());
                if (status && !acceptable(status)) {
                    context.report(
                        { start: node.start, end: node.propertyEnd },
                        `CSS property ${name} isn't part of the chosen Baseline.`,
                    );
                    return;
                }
                for (const value of node.value) {
                    if (value.type !== "Identifier") continue;
                    const lower = value.value.toLowerCase();
                    if (colors.has(lower)) continue;
                    const allow = Object.entries(
                        context.options.allowPropertyValues ?? {},
                    ).some(
                        ([property, list]) =>
                            property.toLowerCase() === name.toLowerCase() &&
                            list.some((item) => item.toLowerCase() === lower),
                    );
                    if (allow) continue;
                    const known = BASELINE_PROPERTY_VALUES.get(
                        `${name.toLowerCase()}:${lower}`,
                    );
                    if (known && !acceptable(known)) {
                        context.report(
                            value,
                            `CSS property value ${name}: ${value.value} isn't part of the chosen Baseline.`,
                        );
                        return;
                    }
                }
            },
            CssRule(node) {
                if (!node.selectors) return;
                for (const { compound } of compounds(node.selectors))
                    for (const child of compound.children) {
                        if (
                            (child.type !== "PseudoClassSelector" &&
                                child.type !== "PseudoElementSelector") ||
                            child.argument
                        )
                            continue;
                        if (allowed(context.options.allowSelectors, child.name))
                            continue;
                        const start = context.text.indexOf(
                            child.name,
                            child.start + 1,
                        );
                        check(
                            BASELINE_SELECTORS,
                            child.name,
                            { start, end: start + child.name.length },
                            child.type === "PseudoClassSelector"
                                ? "pseudo-class"
                                : "pseudo-element",
                        );
                    }
            },
            CssAtRule(node) {
                const keyword = node.keyword;
                const name = /^(?:-[a-z]+-)?keyframes$/.test(keyword)
                    ? "keyframes"
                    : keyword === "-moz-document"
                      ? "document"
                      : keyword;
                if (
                    atRules.has(name) &&
                    !allowed(context.options.allowAtRules, name)
                )
                    check(
                        BASELINE_AT_RULES,
                        name,
                        { start: node.start, end: node.start + 1 },
                        "at-rule",
                    );
                if (
                    keyword === "media" ||
                    keyword === "container" ||
                    keyword === "import" ||
                    keyword === "custom-media"
                ) {
                    // plain features, like `(scripting: none)`
                    const visit = (list: readonly Css.Value[]) => {
                        for (const value of list) {
                            if (
                                value.type !== "SimpleBlock" &&
                                value.type !== "Function"
                            )
                                continue;
                            const colon = value.children.findIndex(
                                (child) => child.type === "Colon",
                            );
                            const feature = value.children[0];
                            if (
                                value.type === "SimpleBlock" &&
                                colon === 1 &&
                                feature?.type === "Identifier"
                            ) {
                                if (
                                    !allowed(
                                        context.options.allowMediaConditions,
                                        feature.value,
                                    )
                                )
                                    check(
                                        BASELINE_MEDIA_CONDITIONS,
                                        feature.value,
                                        feature,
                                        "media condition",
                                    );
                            } else visit(value.children);
                        }
                    };
                    visit(node.prelude);
                }
                functions(node.prelude);
            },
        };
    },
});
