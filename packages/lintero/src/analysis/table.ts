/**
 * A lookup table without a prototype: names from the linted code, like
 * `constructor`, `toString` or `__proto__`, find nothing in it that
 * `Object.prototype` has, also with `in`.
 */
export default function table<T extends object>(entries: T): T {
    return Object.assign(Object.create(null) as T, entries);
}
