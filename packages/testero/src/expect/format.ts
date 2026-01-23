/** Prints values like Jest's pretty-format, for messages and diffs. */
// biome-ignore lint/complexity/noStaticOnlyClass: groups printing helpers
export default class Format {
    /** A value with one property or item per line. */
    static value(value: unknown): string {
        return Format.#print(value, "", true, []);
    }

    /** A value on one line. */
    static inline(value: unknown): string {
        return Format.#print(value, "", false, []);
    }

    /** A line diff of two values, `-` for expected lines and `+` for received ones. */
    static diff(expected: unknown, received: unknown): string {
        const a = Format.value(expected).split("\n");
        const b = Format.value(received).split("\n");
        if (a.length * b.length > 4_000_000)
            return `Expected: ${Format.inline(expected)}\nReceived: ${Format.inline(received)}`;
        return ["- Expected", "+ Received", "", ...Format.#lines(a, b)].join(
            "\n",
        );
    }

    /** Lines of a longest common subsequence diff. */
    static #lines(a: string[], b: string[]): string[] {
        const lengths = Array.from({ length: a.length + 1 }, () =>
            new Array<number>(b.length + 1).fill(0),
        );
        for (let i = a.length - 1; i >= 0; i--)
            for (let j = b.length - 1; j >= 0; j--)
                (lengths[i] as number[])[j] =
                    a[i] === b[j]
                        ? ((lengths[i + 1] as number[])[j + 1] as number) + 1
                        : Math.max(
                              (lengths[i + 1] as number[])[j] as number,
                              (lengths[i] as number[])[j + 1] as number,
                          );

        const lines: string[] = [];
        let i = 0;
        let j = 0;
        while (i < a.length || j < b.length) {
            if (i < a.length && j < b.length && a[i] === b[j]) {
                lines.push(`  ${a[i++]}`);
                j++;
            } else if (
                j >= b.length ||
                (i < a.length &&
                    ((lengths[i + 1] as number[])[j] as number) >=
                        ((lengths[i] as number[])[j + 1] as number))
            )
                lines.push(`- ${a[i++]}`);
            else lines.push(`+ ${b[j++]}`);
        }
        return lines;
    }

    static #print(
        value: unknown,
        indent: string,
        multiline: boolean,
        seen: unknown[],
    ): string {
        switch (typeof value) {
            case "string":
                return JSON.stringify(value);
            case "number":
                return Object.is(value, -0) ? "-0" : String(value);
            case "bigint":
                return `${value}n`;
            case "symbol":
                return value.toString();
            case "function":
                return `[Function ${value.name || "anonymous"}]`;
            case "undefined":
                return "undefined";
            case "boolean":
                return String(value);
        }
        if (value === null) return "null";

        const object = value as Record<PropertyKey, unknown>;
        if (typeof object.asymmetricMatch === "function") return String(object);
        if (value instanceof Date)
            return Number.isNaN(value.getTime())
                ? "Date { NaN }"
                : value.toISOString();
        if (value instanceof RegExp) return String(value);
        if (value instanceof Error) return `[${value.name}: ${value.message}]`;
        if (seen.includes(value)) return "[Circular]";

        const inner = [...seen, value];
        const print = (item: unknown) =>
            Format.#print(item, `${indent}  `, multiline, inner);
        const name = (object.constructor as { name?: string } | undefined)
            ?.name;

        if (value instanceof Map)
            return Format.#block(
                `Map {`,
                "}",
                [...value].map(
                    ([key, item]) => `${print(key)} => ${print(item)}`,
                ),
                indent,
                multiline,
            );
        if (value instanceof Set)
            return Format.#block(
                "Set {",
                "}",
                [...value].map(print),
                indent,
                multiline,
            );
        if (Array.isArray(value) || ArrayBuffer.isView(value)) {
            const items = Array.from(value as ArrayLike<unknown>, print);
            const prefix = name && name !== "Array" ? `${name} [` : "[";
            return Format.#block(prefix, "]", items, indent, multiline);
        }

        const keys = [
            ...Object.keys(object),
            ...Object.getOwnPropertySymbols(object).filter(
                (symbol) =>
                    Object.getOwnPropertyDescriptor(object, symbol)?.enumerable,
            ),
        ];
        const entries = keys.map(
            (key) =>
                `${typeof key === "symbol" ? key.toString() : JSON.stringify(key)}: ${print(object[key])}`,
        );
        const prefix = name && name !== "Object" ? `${name} {` : "{";
        return Format.#block(prefix, "}", entries, indent, multiline);
    }

    static #block(
        open: string,
        close: string,
        entries: string[],
        indent: string,
        multiline: boolean,
    ): string {
        if (entries.length === 0) return `${open}${close}`;
        if (!multiline) return `${open}${entries.join(", ")}${close}`;
        return `${open}\n${entries.map((entry) => `${indent}  ${entry},\n`).join("")}${indent}${close}`;
    }
}
