/** Deep equality of `toEqual` and `toStrictEqual`, and the subsets of `toMatchObject`. */
// biome-ignore lint/complexity/noStaticOnlyClass: groups comparison helpers
export default class Equality {
    /** Whether a value matches by its own rule, like `expect.any(Number)`. */
    static asymmetric(
        value: unknown,
    ): value is { asymmetricMatch(other: unknown): boolean } {
        return (
            typeof value === "object" &&
            value !== null &&
            typeof (value as { asymmetricMatch?: unknown }).asymmetricMatch ===
                "function"
        );
    }

    /**
     * Whether two values are deeply equal. Loosely, properties set to
     * undefined count as missing; strictly, types and holes in arrays count.
     */
    static equals(a: unknown, b: unknown, strict = false): boolean {
        return Equality.#equals(a, b, strict, [], []);
    }

    /** Whether received has every property expected has, recursively, like `toMatchObject`. */
    static matches(received: unknown, expected: unknown): boolean {
        if (Equality.asymmetric(expected))
            return expected.asymmetricMatch(received);
        if (
            !Equality.#plainish(expected) ||
            typeof received !== "object" ||
            received === null
        )
            return Equality.equals(received, expected);
        if (Array.isArray(expected))
            return (
                Array.isArray(received) &&
                received.length === expected.length &&
                expected.every((item, index) =>
                    Equality.matches(received[index], item),
                )
            );
        return Equality.#keys(expected, true).every(
            (key) =>
                key in received &&
                Equality.matches(
                    (received as Record<PropertyKey, unknown>)[key],
                    (expected as Record<PropertyKey, unknown>)[key],
                ),
        );
    }

    /** Objects and arrays that `toMatchObject` compares by their properties. */
    static #plainish(value: unknown): value is object {
        return (
            typeof value === "object" &&
            value !== null &&
            !(value instanceof Date) &&
            !(value instanceof RegExp) &&
            !(value instanceof Map) &&
            !(value instanceof Set) &&
            !(value instanceof Error)
        );
    }

    static #equals(
        a: unknown,
        b: unknown,
        strict: boolean,
        aSeen: unknown[],
        bSeen: unknown[],
    ): boolean {
        if (Equality.asymmetric(a)) return a.asymmetricMatch(b);
        if (Equality.asymmetric(b)) return b.asymmetricMatch(a);
        if (Object.is(a, b)) return true;
        if (
            typeof a !== "object" ||
            typeof b !== "object" ||
            a === null ||
            b === null
        )
            return false;

        const tag = Object.prototype.toString.call(a);
        if (tag !== Object.prototype.toString.call(b)) return false;
        if (strict && Object.getPrototypeOf(a) !== Object.getPrototypeOf(b))
            return false;

        if (a instanceof Date)
            return Object.is(a.getTime(), (b as Date).getTime());
        if (a instanceof RegExp) return String(a) === String(b);
        if (a instanceof Error && b instanceof Error)
            return a.name === b.name && a.message === b.message;
        if (a instanceof Number || a instanceof String || a instanceof Boolean)
            return Object.is(
                a.valueOf(),
                (b as { valueOf(): unknown }).valueOf(),
            );

        // cycles are equal when both sides loop back at the same depth
        const index = aSeen.indexOf(a);
        if (index >= 0) return bSeen[index] === b;
        aSeen.push(a);
        bSeen.push(b);
        try {
            return Equality.#structures(a, b, strict, aSeen, bSeen);
        } finally {
            aSeen.pop();
            bSeen.pop();
        }
    }

    static #structures(
        a: object,
        b: object,
        strict: boolean,
        aSeen: unknown[],
        bSeen: unknown[],
    ): boolean {
        const equal = (x: unknown, y: unknown) =>
            Equality.#equals(x, y, strict, aSeen, bSeen);

        if (a instanceof Map && b instanceof Map)
            return (
                a.size === b.size &&
                [...a].every(([key, value]) =>
                    b.has(key)
                        ? equal(value, b.get(key))
                        : [...b].some(
                              ([other, item]) =>
                                  equal(key, other) && equal(value, item),
                          ),
                )
            );
        if (a instanceof Set && b instanceof Set)
            return (
                a.size === b.size &&
                [...a].every(
                    (value) =>
                        b.has(value) ||
                        [...b].some((other) => equal(value, other)),
                )
            );

        if (Array.isArray(a) || ArrayBuffer.isView(a)) {
            const left = a as unknown as ArrayLike<unknown>;
            const right = b as unknown as ArrayLike<unknown>;
            if (left.length !== right.length) return false;
            for (let index = 0; index < left.length; index++) {
                if (strict && index in left !== index in right) return false;
                if (!equal(left[index], right[index])) return false;
            }
        }

        const indexed = Array.isArray(a) || ArrayBuffer.isView(a);
        const keysOf = (object: object) =>
            Equality.#keys(object, strict).filter(
                (key) =>
                    !(indexed && typeof key === "string" && /^\d+$/.test(key)),
            );
        const aKeys = keysOf(a);
        const bKeys = keysOf(b);
        if (aKeys.length !== bKeys.length) return false;
        return aKeys.every(
            (key) =>
                Object.hasOwn(b, key) &&
                equal(
                    (a as Record<PropertyKey, unknown>)[key],
                    (b as Record<PropertyKey, unknown>)[key],
                ),
        );
    }

    /** Own enumerable keys, without the ones set to undefined unless strict. */
    static #keys(object: object, strict: boolean): PropertyKey[] {
        const record = object as Record<PropertyKey, unknown>;
        const keys: PropertyKey[] = [
            ...Object.keys(object),
            ...Object.getOwnPropertySymbols(object).filter(
                (symbol) =>
                    Object.getOwnPropertyDescriptor(object, symbol)?.enumerable,
            ),
        ];
        return strict ? keys : keys.filter((key) => record[key] !== undefined);
    }
}
