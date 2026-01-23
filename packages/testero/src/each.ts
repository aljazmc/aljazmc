import Format from "./expect/format.js";

/** Rows and titles of `test.each` and `describe.each`. */
// biome-ignore lint/complexity/noStaticOnlyClass: groups table helpers
export default class Each {
    /**
     * The argument lists of a table: rows of arrays are spread, other rows
     * are one argument, and a tagged template gives one object per row.
     */
    static rows(table: unknown, values: unknown[]): unknown[][] {
        if (Each.#template(table)) {
            const names = table
                .join("")
                .trim()
                .split(/\s*\|\s*/);
            const rows: unknown[][] = [];
            for (let index = 0; index < values.length; index += names.length)
                rows.push([
                    Object.fromEntries(
                        names.map((name, offset) => [
                            name,
                            values[index + offset],
                        ]),
                    ),
                ]);
            return rows;
        }
        if (!Array.isArray(table))
            throw new TypeError(
                "each needs an array or a tagged template table",
            );
        return table.map((row) => (Array.isArray(row) ? row : [row]));
    }

    /** A title with `$name` properties of an object row, or printf placeholders. */
    static title(title: string, args: unknown[], index: number): string {
        const [first] = args;
        if (args.length === 1 && Each.#plain(first) && title.includes("$"))
            return title.replace(
                /\$([\w$]+(?:\.[\w$]+)*)/g,
                (match, path: string) =>
                    path === "#"
                        ? String(index)
                        : Each.#show(Each.#at(first, path.split("."), match)),
            );

        const rest = [...args];
        return title.replace(/%([sdifjoOp#$%])/g, (match, flag: string) => {
            if (flag === "%") return "%";
            if (flag === "#") return String(index);
            if (flag === "$") return String(index + 1);
            if (rest.length === 0) return match;
            const value = rest.shift();
            switch (flag) {
                case "d":
                case "i":
                    return String(
                        flag === "i"
                            ? Math.trunc(Number(value))
                            : Number(value),
                    );
                case "f":
                    return String(Number(value));
                case "j":
                    return JSON.stringify(value);
                case "s":
                    return Each.#show(value);
                default:
                    return Format.inline(value);
            }
        });
    }

    static #template(table: unknown): table is TemplateStringsArray {
        return Array.isArray(table) && "raw" in table;
    }

    static #plain(value: unknown): value is Record<string, unknown> {
        return (
            typeof value === "object" && value !== null && !Array.isArray(value)
        );
    }

    static #at(value: unknown, path: string[], fallback: string): unknown {
        let current = value;
        for (const key of path) {
            if (
                typeof current !== "object" ||
                current === null ||
                !(key in current)
            )
                return fallback;
            current = (current as Record<string, unknown>)[key];
        }
        return current;
    }

    /** Strings as they are, other values like Jest prints them. */
    static #show(value: unknown): string {
        return typeof value === "string" ? value : Format.inline(value);
    }
}
