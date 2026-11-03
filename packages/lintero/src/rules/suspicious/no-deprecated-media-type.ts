import type { Css } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

const deprecated = new Set(
    "aural braille embossed handheld projection speech tty tv".split(" "),
);

/** Identifiers of media queries that are media types, not `not`, `only`, `and` or `or`. */
function* types(values: readonly Css.Value[]): Generator<Css.Identifier> {
    for (const value of values)
        if (
            value.type === "Identifier" &&
            !/^(?:not|only|and|or)$/i.test(value.value)
        )
            yield value;
}

export default rule<{ allow?: string[] }>({
    name: "noDeprecatedMediaType",
    group: "suspicious",
    severity: "warn",
    recommended: true,
    fix: "none",
    languages: ["css"],
    create: (context) => ({
        CssAtRule(node) {
            let values: readonly Css.Value[];
            if (node.keyword === "media") values = node.prelude;
            else if (node.keyword === "import") values = node.prelude.slice(1);
            else if (node.keyword === "custom-media")
                values = node.prelude.slice(1);
            else return;
            const allow = (context.options.allow ?? []).map((name) =>
                name.toLowerCase(),
            );
            for (const type of types(values)) {
                const lower = type.value.toLowerCase();
                if (allow.includes(lower) || !deprecated.has(lower)) continue;
                context.report(
                    type,
                    `Unexpected deprecated media type: ${type.value}`,
                );
            }
        },
    }),
});
