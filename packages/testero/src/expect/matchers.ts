import Mocks, { type MockState } from "../mock.js";
import Equality from "./equality.js";
import Format from "./format.js";

export interface MatcherResult {
    pass: boolean;
    /** The failure message, worded for `.not` too. */
    message: () => string;
}

/** What a matcher knows besides its arguments. */
export interface MatcherContext {
    isNot: boolean;
    promise: "" | "resolves" | "rejects";
}

export type Matcher = (
    this: MatcherContext,
    received: unknown,
    // biome-ignore lint/suspicious/noExplicitAny: matchers take any arguments
    ...expected: any[]
) => MatcherResult;

const show = (value: unknown) => Format.inline(value);

/** The first line of a failure message, like `expect(received).not.toBe(expected)`. */
export const hint = (
    context: MatcherContext,
    name: string,
    expected = "expected",
): string =>
    `expect(received)${context.promise ? `.${context.promise}` : ""}${context.isNot ? ".not" : ""}.${name}(${expected})`;

/** Expected and received values, as a diff when they span several lines. */
const difference = (expected: unknown, received: unknown): string => {
    const multiline =
        Format.value(expected).includes("\n") ||
        Format.value(received).includes("\n");
    return multiline
        ? Format.diff(expected, received)
        : `Expected: ${show(expected)}\nReceived: ${show(received)}`;
};

/** The calls of a mock, or a matcher error for other values. */
const callsOf = (
    context: MatcherContext,
    name: string,
    received: unknown,
): MockState => {
    if (!Mocks.isMockFunction(received))
        throw new Error(
            `${hint(context, name)}\n\nMatcher error: received value must be a mock or spy function\n\nReceived: ${show(received)}`,
        );
    return received.mock;
};

const listCalls = (calls: unknown[][]): string =>
    calls.length === 0
        ? "Number of calls: 0"
        : `Received\n${calls
              .map(
                  (call, index) =>
                      `  ${index + 1}: ${call.map(show).join(", ")}`,
              )
              .join("\n")}\n\nNumber of calls: ${calls.length}`;

/** Matchers that compare a number to an expected one. */
const comparison = (
    name: string,
    operator: string,
    test: (a: number, b: number) => boolean,
): Matcher =>
    function (received, expected) {
        if (typeof received !== "number" && typeof received !== "bigint")
            throw new Error(
                `${hint(this, name)}\n\nMatcher error: received value must be a number or bigint\n\nReceived: ${show(received)}`,
            );
        return {
            pass: test(received as number, expected),
            message: () =>
                `${hint(this, name)}\n\nExpected:${this.isNot ? " not" : ""} ${operator} ${show(expected)}\nReceived:${" ".repeat(operator.length + (this.isNot ? 6 : 2))}${show(received)}`,
        };
    };

/** Matchers that check one property of the received value. */
const predicate = (name: string, test: (value: unknown) => boolean): Matcher =>
    function (received) {
        return {
            pass: test(received),
            message: () =>
                `${hint(this, name, "")}\n\nReceived: ${show(received)}`,
        };
    };

/** What `toThrow` checks of a thrown value, and how it words it. */
const thrownMatch = (
    expected: unknown,
    thrown: unknown,
): { pass: boolean; expected: string; received: string } => {
    const message = thrown instanceof Error ? thrown.message : String(thrown);
    const received = `Received message: ${JSON.stringify(message)}`;
    if (expected === undefined) return { pass: true, expected: "", received };
    if (typeof expected === "string")
        return {
            pass: message.includes(expected),
            expected: `Expected substring: ${JSON.stringify(expected)}`,
            received,
        };
    if (expected instanceof RegExp)
        return {
            pass: expected.test(message),
            expected: `Expected pattern: ${expected}`,
            received,
        };
    if (typeof expected === "function")
        return {
            pass: thrown instanceof expected,
            expected: `Expected constructor: ${expected.name}`,
            received: `Received constructor: ${
                (thrown as object | null)?.constructor?.name ?? show(thrown)
            }\n${received}`,
        };
    if (Equality.asymmetric(expected))
        return {
            pass: expected.asymmetricMatch(thrown),
            expected: `Expected asymmetric matcher: ${String(expected)}`,
            received: `Received value: ${show(thrown)}`,
        };
    if (expected instanceof Error)
        return {
            pass: message === expected.message,
            expected: `Expected message: ${JSON.stringify(expected.message)}`,
            received,
        };
    throw new Error(
        `Matcher error: expected value must be a string, regular expression, class, error or asymmetric matcher\n\nExpected: ${show(expected)}`,
    );
};

/** The value at a property path like `a.b[0]`, and the deepest path that exists. */
const property = (
    object: unknown,
    path: string | PropertyKey[],
): { has: boolean; value: unknown; found: PropertyKey[] } => {
    const keys =
        typeof path === "string"
            ? path.split(/[.[\]]/).filter((key) => key !== "")
            : path;
    let current = object;
    const found: PropertyKey[] = [];
    for (const key of keys) {
        if (
            current === null ||
            current === undefined ||
            !(key in Object(current))
        )
            return { has: false, value: current, found };
        current = (current as Record<PropertyKey, unknown>)[key];
        found.push(key);
    }
    return { has: true, value: current, found };
};

/** Jest's matchers, `this` tells whether `.not`, `.resolves` or `.rejects` were used. */
export const matchers: Record<string, Matcher> = {
    toBe(received, expected) {
        const pass = Object.is(received, expected);
        return {
            pass,
            message: () => {
                const header = `${hint(this, "toBe")} // Object.is equality\n\n`;
                if (this.isNot)
                    return `${header}Expected: not ${show(expected)}`;
                const deep = Equality.equals(received, expected, true)
                    ? '\n\nIf it should pass with deep equality, replace "toBe" with "toStrictEqual"'
                    : "";
                return `${header}${difference(expected, received)}${deep}`;
            },
        };
    },

    toEqual(received, expected) {
        return {
            pass: Equality.equals(received, expected),
            message: () =>
                `${hint(this, "toEqual")} // deep equality\n\n${
                    this.isNot
                        ? `Expected: not ${show(expected)}`
                        : difference(expected, received)
                }`,
        };
    },

    toStrictEqual(received, expected) {
        return {
            pass: Equality.equals(received, expected, true),
            message: () =>
                `${hint(this, "toStrictEqual")} // deep equality\n\n${
                    this.isNot
                        ? `Expected: not ${show(expected)}`
                        : difference(expected, received)
                }`,
        };
    },

    toMatchObject(received, expected) {
        if (typeof received !== "object" || received === null)
            throw new Error(
                `${hint(this, "toMatchObject")}\n\nMatcher error: received value must be a non-null object\n\nReceived: ${show(received)}`,
            );
        return {
            pass: Equality.matches(received, expected),
            message: () =>
                `${hint(this, "toMatchObject")}\n\n${
                    this.isNot
                        ? `Expected: not ${show(expected)}`
                        : difference(expected, received)
                }`,
        };
    },

    toBeDefined: predicate("toBeDefined", (value) => value !== undefined),
    toBeUndefined: predicate("toBeUndefined", (value) => value === undefined),
    toBeNull: predicate("toBeNull", (value) => value === null),
    toBeNaN: predicate("toBeNaN", (value) => Number.isNaN(value)),
    toBeTruthy: predicate("toBeTruthy", (value) => Boolean(value)),
    toBeFalsy: predicate("toBeFalsy", (value) => !value),

    toBeGreaterThan: comparison("toBeGreaterThan", ">", (a, b) => a > b),
    toBeGreaterThanOrEqual: comparison(
        "toBeGreaterThanOrEqual",
        ">=",
        (a, b) => a >= b,
    ),
    toBeLessThan: comparison("toBeLessThan", "<", (a, b) => a < b),
    toBeLessThanOrEqual: comparison(
        "toBeLessThanOrEqual",
        "<=",
        (a, b) => a <= b,
    ),

    toBeCloseTo(received, expected: number, digits = 2) {
        const value = received as number;
        const pass =
            value === expected ||
            Math.abs(expected - value) < 10 ** -digits / 2;
        return {
            pass,
            message: () =>
                `${hint(this, "toBeCloseTo", "expected, precision")}\n\nExpected: ${this.isNot ? "not " : ""}${show(expected)}\nReceived: ${show(received)}\n\nExpected precision:    ${digits}\nExpected difference: < ${10 ** -digits / 2}\nReceived difference:   ${Math.abs(expected - value)}`,
        };
    },

    toBeInstanceOf(received, expected) {
        return {
            pass: received instanceof expected,
            message: () =>
                `${hint(this, "toBeInstanceOf")}\n\nExpected constructor: ${this.isNot ? "not " : ""}${expected.name}\nReceived constructor: ${
                    (received as object | null)?.constructor?.name ??
                    show(received)
                }`,
        };
    },

    toContain(received, expected) {
        const text = typeof received === "string";
        if (
            !text &&
            (received === null ||
                typeof (received as Iterable<unknown>)?.[Symbol.iterator] !==
                    "function")
        )
            throw new Error(
                `${hint(this, "toContain")}\n\nMatcher error: received value must not be null nor undefined, and must be iterable\n\nReceived: ${show(received)}`,
            );
        const pass = text
            ? received.includes(String(expected))
            : [...(received as Iterable<unknown>)].includes(expected);
        return {
            pass,
            message: () =>
                `${hint(this, "toContain")}\n\nExpected ${text ? "substring" : "value"}: ${this.isNot ? "not " : ""}${show(expected)}\nReceived ${text ? "string" : "value"}:${text ? "    " : "     "}${show(received)}`,
        };
    },

    toContainEqual(received, expected) {
        const items = [...(received as Iterable<unknown>)];
        return {
            pass: items.some((item) => Equality.equals(item, expected)),
            message: () =>
                `${hint(this, "toContainEqual")}\n\nExpected value: ${this.isNot ? "not " : ""}${show(expected)}\nReceived value: ${show(received)}`,
        };
    },

    toHaveLength(received, expected: number) {
        const length = (received as { length?: unknown } | null)?.length;
        if (typeof length !== "number")
            throw new Error(
                `${hint(this, "toHaveLength")}\n\nMatcher error: received value must have a length property whose value must be a number\n\nReceived: ${show(received)}`,
            );
        return {
            pass: length === expected,
            message: () =>
                `${hint(this, "toHaveLength")}\n\nExpected length: ${this.isNot ? "not " : ""}${expected}\nReceived length: ${length}\nReceived value:  ${show(received)}`,
        };
    },

    toHaveProperty(
        received,
        path: string | PropertyKey[],
        ...value: unknown[]
    ) {
        const { has, value: actual, found } = property(received, path);
        const checksValue = value.length > 0;
        const pass = has && (!checksValue || Equality.equals(actual, value[0]));
        const shown =
            typeof path === "string" ? path : path.map(String).join(".");
        return {
            pass,
            message: () => {
                const header = `${hint(this, "toHaveProperty", checksValue ? "path, value" : "path")}\n\nExpected path: ${JSON.stringify(shown)}\n`;
                if (!has)
                    return `${header}Received path: ${JSON.stringify(found.map(String).join("."))}\n\nReceived value: ${show(actual)}`;
                return checksValue
                    ? `${header}\n${this.isNot ? `Expected value: not ${show(value[0])}` : difference(value[0], actual)}`
                    : `${header}\nReceived value: ${show(actual)}`;
            },
        };
    },

    toMatch(received, expected: string | RegExp) {
        if (typeof received !== "string")
            throw new Error(
                `${hint(this, "toMatch")}\n\nMatcher error: received value must be a string\n\nReceived: ${show(received)}`,
            );
        const pattern = typeof expected === "string";
        return {
            pass: pattern
                ? received.includes(expected)
                : expected.test(received),
            message: () =>
                `${hint(this, "toMatch")}\n\nExpected ${pattern ? "substring" : "pattern"}: ${this.isNot ? "not " : ""}${pattern ? show(expected) : String(expected)}\nReceived string:${pattern ? "    " : "  "}${show(received)}`,
        };
    },

    toThrow(received, expected?: unknown) {
        let thrown: { value: unknown } | undefined;
        if (this.promise === "rejects") thrown = { value: received };
        else if (typeof received !== "function")
            throw new Error(
                `${hint(this, "toThrow")}\n\nMatcher error: received value must be a function\n\nReceived: ${show(received)}`,
            );
        else
            try {
                received();
            } catch (error) {
                thrown = { value: error };
            }

        const match = thrown ? thrownMatch(expected, thrown.value) : undefined;
        const name = expected === undefined ? "" : "expected";
        return {
            pass: match?.pass ?? false,
            message: () => {
                const header = `${hint(this, "toThrow", name)}\n\n`;
                if (!thrown || !match)
                    return `${header}${
                        expected === undefined
                            ? ""
                            : `${thrownMatch(expected, undefined).expected}\n\n`
                    }Received function did not throw`;
                if (this.isNot && expected === undefined)
                    return `${header}Error name:    ${(thrown.value as Error)?.name ?? "thrown"}\n${match.received}`;
                return `${header}${match.expected.replace(": ", this.isNot ? ": not " : ": ")}\n${match.received}`;
            },
        };
    },

    toHaveBeenCalled(received) {
        const { calls } = callsOf(this, "toHaveBeenCalled", received);
        return {
            pass: calls.length > 0,
            message: () =>
                `${hint(this, "toHaveBeenCalled", "")}\n\nExpected number of calls: ${this.isNot ? "0" : ">= 1"}\n${listCalls(calls)}`,
        };
    },

    toHaveBeenCalledTimes(received, expected: number) {
        const { calls } = callsOf(this, "toHaveBeenCalledTimes", received);
        return {
            pass: calls.length === expected,
            message: () =>
                `${hint(this, "toHaveBeenCalledTimes")}\n\nExpected number of calls: ${this.isNot ? "not " : ""}${expected}\nReceived number of calls: ${calls.length}`,
        };
    },

    toHaveBeenCalledWith(received, ...expected: unknown[]) {
        const { calls } = callsOf(this, "toHaveBeenCalledWith", received);
        return {
            pass: calls.some((call) => Equality.equals(call, expected)),
            message: () =>
                `${hint(this, "toHaveBeenCalledWith", "...expected")}\n\nExpected: ${this.isNot ? "not " : ""}${expected.map(show).join(", ")}\n${listCalls(calls)}`,
        };
    },

    toHaveBeenLastCalledWith(received, ...expected: unknown[]) {
        const { calls } = callsOf(this, "toHaveBeenLastCalledWith", received);
        const last = calls.at(-1);
        return {
            pass: last !== undefined && Equality.equals(last, expected),
            message: () =>
                `${hint(this, "toHaveBeenLastCalledWith", "...expected")}\n\nExpected: ${this.isNot ? "not " : ""}${expected.map(show).join(", ")}\n${listCalls(calls)}`,
        };
    },

    toHaveBeenNthCalledWith(received, nth: number, ...expected: unknown[]) {
        const { calls } = callsOf(this, "toHaveBeenNthCalledWith", received);
        const call = calls[nth - 1];
        return {
            pass: call !== undefined && Equality.equals(call, expected),
            message: () =>
                `${hint(this, "toHaveBeenNthCalledWith", "n, ...expected")}\n\nn: ${nth}\nExpected: ${this.isNot ? "not " : ""}${expected.map(show).join(", ")}\n${listCalls(calls)}`,
        };
    },

    toHaveReturned(received) {
        const { results } = callsOf(this, "toHaveReturned", received);
        const returns = results.filter((result) => result.type === "return");
        return {
            pass: returns.length > 0,
            message: () =>
                `${hint(this, "toHaveReturned", "")}\n\nExpected number of returns: ${this.isNot ? "0" : ">= 1"}\nReceived number of returns: ${returns.length}`,
        };
    },

    toHaveReturnedTimes(received, expected: number) {
        const { results } = callsOf(this, "toHaveReturnedTimes", received);
        const returns = results.filter((result) => result.type === "return");
        return {
            pass: returns.length === expected,
            message: () =>
                `${hint(this, "toHaveReturnedTimes")}\n\nExpected number of returns: ${this.isNot ? "not " : ""}${expected}\nReceived number of returns: ${returns.length}`,
        };
    },

    toHaveReturnedWith(received, expected: unknown) {
        const { results } = callsOf(this, "toHaveReturnedWith", received);
        return {
            pass: results.some(
                (result) =>
                    result.type === "return" &&
                    Equality.equals(result.value, expected),
            ),
            message: () =>
                `${hint(this, "toHaveReturnedWith")}\n\nExpected: ${this.isNot ? "not " : ""}${show(expected)}\nReceived: ${results
                    .map((result) => show(result.value))
                    .join(", ")}`,
        };
    },

    toHaveLastReturnedWith(received, expected: unknown) {
        const { results } = callsOf(this, "toHaveLastReturnedWith", received);
        const last = results.at(-1);
        return {
            pass:
                last?.type === "return" &&
                Equality.equals(last.value, expected),
            message: () =>
                `${hint(this, "toHaveLastReturnedWith")}\n\nExpected: ${this.isNot ? "not " : ""}${show(expected)}\nReceived: ${last ? show(last.value) : "no calls"}`,
        };
    },

    toHaveNthReturnedWith(received, nth: number, expected: unknown) {
        const { results } = callsOf(this, "toHaveNthReturnedWith", received);
        const result = results[nth - 1];
        return {
            pass:
                result?.type === "return" &&
                Equality.equals(result.value, expected),
            message: () =>
                `${hint(this, "toHaveNthReturnedWith", "n, expected")}\n\nn: ${nth}\nExpected: ${this.isNot ? "not " : ""}${show(expected)}\nReceived: ${result ? show(result.value) : "no call"}`,
        };
    },
};
