import type { Css } from "@aljazmc/syntax";

/** A token of a resolved selector, like Biome's semantic model keeps them. */
export interface SelectorToken {
    /** Combinators, `&`, the type or universal selector of a compound, or one of its simple selectors. */
    kind: "combinator" | "space" | "amp" | "type" | "simple";
    text: string;
}

export type Specificity = [number, number, number];

/** A selector of a rule, resolved against the selectors of the rule it is nested in. */
export interface SemanticSelector {
    node: Css.Selector;
    /** One resolution per selector of the parent rule, or one without a parent. */
    resolved: SelectorToken[][];
    specificity: Specificity;
}

/** A rule or an at-rule with a block, with the rules nested in it. */
export interface SemanticRule {
    node: Css.Rule | Css.AtRule;
    selectors: SemanticSelector[];
    children: SemanticRule[];
}

const ZERO: Specificity = [0, 0, 0];
const ID: Specificity = [1, 0, 0];
const CLASS: Specificity = [0, 1, 0];
const TYPE: Specificity = [0, 0, 1];

const add = (a: Specificity, b: Specificity): Specificity => [
    a[0] + b[0],
    a[1] + b[1],
    a[2] + b[2],
];

/** Compares specificities, negative when the first is lower. */
export const compare = (a: Specificity, b: Specificity): number =>
    a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

const max = (list: Specificity[]): Specificity =>
    list.reduce((best, item) => (compare(item, best) > 0 ? item : best), ZERO);

export const format = (specificity: Specificity): string =>
    `(${specificity[0]}, ${specificity[1]}, ${specificity[2]})`;

/** Like Biome: `:where()` adds nothing, `:is()`, `:not()`, `:has()` their most specific argument, others a class more. */
function pseudoClass(node: Css.PseudoClassSelector): Specificity {
    const argument = node.argument;
    if (argument?.type !== "SelectorList") return CLASS;
    const name = node.name;
    if (name === "where") return ZERO;
    const base = /^(?:is|not|has|matches)$/.test(name) ? ZERO : CLASS;
    return add(base, max(argument.children.map(selectorSpecificity)));
}

function compoundSpecificity(compound: Css.CompoundSelector): Specificity {
    let result = compound.element?.type === "TypeSelector" ? TYPE : ZERO;
    for (const child of compound.children)
        switch (child.type) {
            case "IdSelector":
                result = add(result, ID);
                break;
            case "ClassSelector":
            case "AttributeSelector":
                result = add(result, CLASS);
                break;
            case "PseudoClassSelector":
                result = add(result, pseudoClass(child));
                break;
            case "PseudoElementSelector":
                result = add(result, TYPE);
                break;
            case "NestingSelector":
                break;
        }
    return result;
}

export function selectorSpecificity(selector: Css.Selector): Specificity {
    return selector.children.reduce(
        (sum, compound) => add(sum, compoundSpecificity(compound)),
        ZERO,
    );
}

/** The text of a source range as tokens written together, without trivia. */
const compact = (text: string): string =>
    text
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/\s*([,>+~()[\]=|^$*])\s*/g, "$1")
        .replace(/\s+/g, " ")
        .trim();

/** The tokens of a selector, a simple selector each. */
function tokens(selector: Css.Selector, text: string): SelectorToken[] {
    const result: SelectorToken[] = [];
    for (const compound of selector.children) {
        const combinator = compound.combinator;
        if (combinator)
            result.push(
                combinator.value === " "
                    ? { kind: "space", text: " " }
                    : { kind: "combinator", text: combinator.value },
            );
        const element = compound.element;
        const nesting = compound.children.filter(
            (child) =>
                child.type === "NestingSelector" &&
                (!element || child.end <= element.start),
        );
        for (const _ of nesting) result.push({ kind: "amp", text: "&" });
        if (element)
            result.push({
                kind: "type",
                text: compact(text.slice(element.start, element.end)),
            });
        for (const child of compound.children) {
            if (nesting.includes(child)) continue;
            if (child.type === "NestingSelector")
                result.push({ kind: "amp", text: "&" });
            else
                result.push({
                    kind: "simple",
                    text: compact(text.slice(child.start, child.end)),
                });
        }
    }
    return result;
}

const isCombinator = (token: SelectorToken | undefined) =>
    token?.kind === "combinator";

/** Resolves selectors of a nested rule: `&` is the parent, without one the parent comes first. */
function resolve(
    current: SelectorToken[],
    parents: SemanticSelector[],
): SelectorToken[][] {
    const amp = current.some((token) => token.kind === "amp");
    return parents.flatMap((parent) =>
        parent.resolved.map((tokens) => {
            if (amp)
                return current.flatMap((token) =>
                    token.kind === "amp" ? tokens : [token],
                );
            const boundary =
                isCombinator(current[0]) || isCombinator(tokens.at(-1));
            return [
                ...tokens,
                ...(boundary ? [] : [{ kind: "space", text: " " } as const]),
                ...current,
            ];
        }),
    );
}

/** The rules of a stylesheet, with resolved selectors and their specificity. */
export function semantic(sheet: Css.Stylesheet, text: string): SemanticRule[] {
    const visit = (
        items: Css.Item[],
        parent: SemanticRule | undefined,
    ): SemanticRule[] => {
        const rules: SemanticRule[] = [];
        for (const item of items) {
            if (item.type === "Rule") {
                const rule: SemanticRule = {
                    node: item,
                    selectors: [],
                    children: [],
                };
                for (const selector of item.selectors?.children ?? []) {
                    const own = tokens(selector, text);
                    const nesting = own.filter(
                        (token) => token.kind === "amp",
                    ).length;
                    const parents = parent?.selectors ?? [];
                    const parentSpecificity = max(
                        parents.map((p) => p.specificity),
                    );
                    let specificity = selectorSpecificity(selector);
                    for (let index = 0; index < Math.max(1, nesting); index++)
                        specificity = add(specificity, parentSpecificity);
                    rule.selectors.push({
                        node: selector,
                        resolved:
                            parents.length > 0 ? resolve(own, parents) : [own],
                        specificity,
                    });
                }
                rule.children = visit(item.block.children, rule);
                rules.push(rule);
            } else if (item.type === "AtRule" && item.block) {
                const rule: SemanticRule = {
                    node: item,
                    selectors: [],
                    children: [],
                };
                // at-rules have no selectors, nested rules resolve against the closest rule
                rule.children = visit(item.block.children, parent);
                rules.push(rule);
            }
        }
        return rules;
    };
    return visit(sheet.children, undefined);
}

/** A resolved selector as Biome prints it, explicit combinators spaced. */
export const display = (tokens: SelectorToken[]): string =>
    tokens
        .map((token) =>
            token.kind === "combinator" ? ` ${token.text} ` : token.text,
        )
        .join("");

/** A resolved selector in canonical order: simple selectors of compounds sorted, type selectors lower-cased. */
export function normalize(tokens: SelectorToken[]): string {
    let result = "";
    let compound: SelectorToken[] = [];
    let combinator = "";
    const flush = () => {
        result += combinator;
        const chunks = compound.map((token, index) =>
            index === 0 && token.kind === "type"
                ? token.text.toLowerCase()
                : token.text,
        );
        const typed = chunks[0] !== undefined && !/^[.#[:&]/.test(chunks[0]);
        const head = typed ? chunks.slice(0, 1) : [];
        const rest = (typed ? chunks.slice(1) : chunks).sort();
        result += head.join("") + rest.join("");
        compound = [];
    };
    for (const token of tokens) {
        if (token.kind === "combinator" || token.kind === "space") {
            flush();
            combinator = token.kind === "space" ? " " : ` ${token.text} `;
        } else compound.push(token);
    }
    flush();
    return result;
}

/** The tokens after the last combinator, the compound selector a rule styles. */
export function tail(tokens: SelectorToken[]): string | undefined {
    let start = 0;
    for (const [index, token] of tokens.entries())
        if (token.kind === "combinator" || token.kind === "space")
            start = index + 1;
    const rest = tokens.slice(start);
    return rest.length > 0
        ? rest.map((token) => `${token.kind}:${token.text}`).join("\u0000")
        : undefined;
}
