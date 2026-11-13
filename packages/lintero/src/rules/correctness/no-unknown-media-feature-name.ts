import type { Css } from "@aljazmc/syntax";
import {
    MEDIA_FEATURE_NAMES,
    VENDOR_PREFIXES,
} from "../../analysis/css-keywords.js";
import { rule } from "../../rules.js";

const features = new Set(MEDIA_FEATURE_NAMES);

/** Known names, and known names after a vendor prefix like `-webkit-min-device-pixel-ratio`. */
const known = (name: string): boolean => {
    const lower = name.toLowerCase();
    if (features.has(lower)) return true;
    return (
        VENDOR_PREFIXES.some((prefix) => lower.startsWith(prefix)) &&
        MEDIA_FEATURE_NAMES.some((feature) => lower.endsWith(feature))
    );
};

/** Whether a media query in parentheses has a feature name that is not known. */
const invalid = (block: Css.SimpleBlock | Css.FunctionValue): boolean => {
    const children = block.children;
    const first = children[0];
    if (!first) return false;
    // nested conditions, like `((a) and (b))` or `(not (a))`
    if (
        first.type === "SimpleBlock" ||
        (first.type === "Function" && /^not$/i.test(first.name)) ||
        (first.type === "Identifier" &&
            /^not$/i.test(first.value) &&
            children[1]?.type === "SimpleBlock")
    )
        return children.some(
            (child) =>
                (child.type === "SimpleBlock" &&
                    child.open === "(" &&
                    invalid(child)) ||
                (child.type === "Function" &&
                    /^not$/i.test(child.name) &&
                    invalid(child)),
        );
    const colon = children.findIndex((child) => child.type === "Colon");
    let name: Css.Value | undefined;
    if (colon > 0) name = children[0];
    else if (children.length === 1) name = first;
    else name = children.find((child) => child.type === "Identifier");
    if (name?.type !== "Identifier" || name.value.startsWith("--"))
        return false;
    return !known(name.value);
};

/** Media queries and the range they cover. */
const lists = (
    node: Css.AtRule,
): { values: Css.Value[]; start: number; end: number } | undefined => {
    let values: Css.Value[];
    if (node.keyword === "media") values = node.prelude;
    else if (node.keyword === "custom-media") values = node.prelude.slice(1);
    else if (node.keyword === "import")
        values = node.prelude
            .slice(1)
            .filter(
                (value) =>
                    !(
                        value.type === "Identifier" &&
                        /^layer$/i.test(value.value)
                    ) &&
                    !(
                        value.type === "Function" &&
                        /^(?:layer|supports)$/i.test(value.name)
                    ),
            );
    else return;
    const first = values[0];
    const last = values.at(-1);
    if (!first || !last) return;
    return { values, start: first.start, end: last.end };
};

export default rule({
    name: "noUnknownMediaFeatureName",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["css"],
    create: (context) => ({
        CssAtRule(node) {
            const list = lists(node);
            if (!list) return;
            if (
                list.values.some(
                    (value) =>
                        value.type === "SimpleBlock" &&
                        value.open === "(" &&
                        invalid(value),
                )
            )
                context.report(list, "Unexpected unknown media feature name.");
        },
    }),
});
