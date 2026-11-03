import type { Css } from "@aljazmc/syntax";
import { compounds } from "../../analysis/css.js";
import {
    A_NPLUS_BNOTATION_PSEUDO_CLASSES,
    A_NPLUS_BOF_SNOTATION_PSEUDO_CLASSES,
    LEVEL_ONE_AND_TWO_PSEUDO_ELEMENTS,
    LINGUISTIC_PSEUDO_CLASSES,
    LOGICAL_COMBINATIONS_PSEUDO_CLASSES,
    OTHER_PSEUDO_CLASSES,
    RESOURCE_STATE_PSEUDO_CLASSES,
    WEBKIT_SCROLLBAR_PSEUDO_CLASSES,
    WEBKIT_SCROLLBAR_PSEUDO_ELEMENTS,
} from "../../analysis/css-keywords.js";
import { rule } from "../../rules.js";

const known = new Set([
    ...LEVEL_ONE_AND_TWO_PSEUDO_ELEMENTS,
    ...A_NPLUS_BNOTATION_PSEUDO_CLASSES,
    ...A_NPLUS_BOF_SNOTATION_PSEUDO_CLASSES,
    ...LINGUISTIC_PSEUDO_CLASSES,
    ...LOGICAL_COMBINATIONS_PSEUDO_CLASSES,
    ...RESOURCE_STATE_PSEUDO_CLASSES,
    ...OTHER_PSEUDO_CLASSES,
]);
const scrollbarClasses = new Set(WEBKIT_SCROLLBAR_PSEUDO_CLASSES);
const scrollbarElements = new Set(WEBKIT_SCROLLBAR_PSEUDO_ELEMENTS);

const vendor = /^-(?:webkit|moz|ms|o)-/;

export default rule<{ ignore?: string[] }>({
    name: "noUnknownPseudoClass",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["css"],
    options: { ignore: [] },
    create: (context) => {
        const ignored = (name: string) =>
            (context.options.ignore ?? []).some(
                (ignore) => ignore.toLowerCase() === name,
            );
        const report = (start: number, name: string) =>
            context.report(
                { start, end: start + name.length },
                `Unexpected unknown pseudo-class ${name}.`,
            );
        /** The name starts after the colon and the trivia after it. */
        const nameStart = (node: Css.PseudoClassSelector) =>
            context.text.indexOf(node.name, node.start + 1);
        return {
            CssRule(node) {
                if (!node.selectors) return;
                for (const { compound } of compounds(node.selectors))
                    for (const [index, child] of compound.children.entries()) {
                        if (child.type !== "PseudoClassSelector") continue;
                        const lower = child.name.toLowerCase();
                        // after a scrollbar pseudo element, its states are pseudo classes too
                        const element = compound.children
                            .slice(0, index)
                            .findLast(
                                (sub) => sub.type === "PseudoElementSelector",
                            );
                        const scrollbar =
                            element?.type === "PseudoElementSelector" &&
                            scrollbarElements.has(
                                context.slice(element).replace(/^:+/, ""),
                            );
                        const valid = scrollbar
                            ? scrollbarClasses.has(lower) || known.has(lower)
                            : lower.startsWith("--") ||
                              vendor.test(lower) ||
                              known.has(lower);
                        if (
                            valid ||
                            ignored(lower) ||
                            (context.cssModules &&
                                (lower === "global" || lower === "local"))
                        )
                            continue;
                        report(nameStart(child), child.name);
                    }
            },
        };
    },
});
