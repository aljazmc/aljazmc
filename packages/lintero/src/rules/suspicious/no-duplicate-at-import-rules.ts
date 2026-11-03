import type { Css } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

/** The media queries of an `@import`, lower-cased as written, after its url, layer and supports. */
const media = (node: Css.AtRule, text: string): string[] => {
    const queries: string[] = [];
    let current: Css.Value[] = [];
    const flush = () => {
        const first = current[0];
        const last = current.at(-1);
        if (first && last)
            queries.push(text.slice(first.start, last.end).toLowerCase());
        current = [];
    };
    for (const value of node.prelude.slice(1)) {
        if (
            (value.type === "Identifier" && /^layer$/i.test(value.value)) ||
            (value.type === "Function" &&
                /^(?:layer|supports)$/i.test(value.name))
        )
            continue;
        if (value.type === "Comma") flush();
        else current.push(value);
    }
    flush();
    return queries;
};

export default rule({
    name: "noDuplicateAtImportRules",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["css"],
    create: (context) => ({
        CssStylesheet(sheet) {
            const imports = new Map<string, Set<string>>();
            for (const item of sheet.children) {
                if (item.type !== "AtRule" || item.keyword !== "import")
                    continue;
                const url = item.prelude[0];
                if (!url) return;
                const address = context
                    .slice(url)
                    .toLowerCase()
                    .replaceAll("url(", "")
                    .replaceAll(")", "")
                    .replaceAll('"', "'");
                const queries = media(item, context.text);
                const previous = imports.get(address);
                if (!previous) {
                    imports.set(address, new Set(queries));
                    continue;
                }
                const duplicate =
                    queries.length === 0 ||
                    previous.size === 0 ||
                    queries.some((query) => {
                        const had = previous.has(query);
                        previous.add(query);
                        return had;
                    });
                if (duplicate) {
                    context.report(
                        { start: item.start + 1, end: item.end },
                        "Each @import should be unique unless differing by media queries.",
                    );
                    return;
                }
            }
        },
    }),
});
