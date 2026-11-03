import type { Css } from "@aljazmc/syntax";
import { declarations } from "../../analysis/css.js";
import { rule } from "../../rules.js";

/** The cells of a row: runs of dots, or names, separated by whitespace. */
const cells = (row: string): string[] => row.match(/\.+|[^\s.]+/g) ?? [];

export default rule({
    name: "noInvalidGridAreas",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["css"],
    create: (context) => ({
        CssBlock(block) {
            const rows: Css.StringValue[] = [];
            for (const declaration of declarations(block))
                if (
                    /^(?:grid|grid-template|grid-template-areas)$/i.test(
                        declaration.property,
                    )
                )
                    for (const value of declaration.value)
                        if (value.type === "String") rows.push(value);
            const first = rows[0];
            if (!first) return;
            const content = (row: Css.StringValue) => row.raw.slice(1, -1);
            const count = cells(content(first)).length;
            for (const row of rows) {
                const length = cells(content(row)).length;
                if (length === 0)
                    return context.report(
                        row,
                        "Empty grid areas are not allowed.",
                    );
                if (length !== count)
                    return context.report(
                        length < count ? row : first,
                        "Inconsistent cell count in grid areas are not allowed.",
                    );
            }
            // every named area is one rectangle
            const areas = new Map<
                string,
                { row: number; start: number; end: number }
            >();
            for (const [index, row] of rows.entries()) {
                const list = cells(content(row));
                for (let start = 0; start < list.length; ) {
                    const name = list[start] as string;
                    let end = start + 1;
                    while (list[end] === name) end++;
                    if (!/^\.+$/.test(name)) {
                        const bounds = areas.get(name);
                        if (!bounds)
                            areas.set(name, { row: index, start, end });
                        else if (
                            bounds.row + 1 !== index ||
                            bounds.start !== start ||
                            bounds.end !== end
                        )
                            return context.report(
                                row,
                                "Duplicate filled in rectangle are not allowed.",
                            );
                        else bounds.row = index;
                    }
                    start = end;
                }
            }
        },
    }),
});
