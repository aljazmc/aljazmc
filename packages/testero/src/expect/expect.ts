import Assertion, { AssertionError, type Matchers } from "./assertion.js";
import {
    Any,
    Anything,
    ArrayContaining,
    CloseTo,
    ObjectContaining,
    StringContaining,
    StringMatching,
} from "./asymmetric.js";
import type { Matcher } from "./matchers.js";

type Constructor = abstract new (...args: never[]) => unknown;

/** The asymmetric matchers that also come in a `not` variant. */
const negatable = (inverse: boolean) => ({
    objectContaining: (object: Record<PropertyKey, unknown>) =>
        new ObjectContaining(object, inverse),
    arrayContaining: (array: unknown[]) => new ArrayContaining(array, inverse),
    stringContaining: (text: string) => new StringContaining(text, inverse),
    stringMatching: (pattern: string | RegExp) =>
        new StringMatching(new RegExp(pattern), inverse),
    closeTo: (number: number, digits?: number) =>
        new CloseTo(number, digits, inverse),
});

/** The `expect` function, its asymmetric matchers and the assertion counts of a test. */
export default class Expect {
    #expected: number | undefined;
    #needed = false;

    /** Starts the counts of a new test. */
    reset(): void {
        Assertion.count = 0;
        this.#expected = undefined;
        this.#needed = false;
    }

    /** Failures of `expect.assertions(n)` and `expect.hasAssertions()` after a test. */
    verify(): Error[] {
        const count = Assertion.count;
        if (this.#expected !== undefined && count !== this.#expected)
            return [
                new AssertionError(
                    `expect.assertions(${this.#expected})\n\nExpected ${this.#expected} assertion${this.#expected === 1 ? "" : "s"} to be called but received ${count} assertion call${count === 1 ? "" : "s"}.`,
                ),
            ];
        if (this.#needed && count === 0)
            return [
                new AssertionError(
                    "expect.hasAssertions()\n\nExpected at least one assertion to be called but received none.",
                ),
            ];
        return [];
    }

    /** The function test files call as `expect`. */
    create() {
        const expect = (received: unknown) =>
            new Assertion(received) as Assertion & Matchers;
        return Object.assign(expect, {
            ...negatable(false),
            not: negatable(true),
            any: (type: Constructor) => new Any(type),
            anything: () => new Anything(undefined),
            assertions: (count: number) => {
                this.#expected = count;
            },
            hasAssertions: () => {
                this.#needed = true;
            },
            extend: (added: Record<string, Matcher>) => {
                for (const [name, matcher] of Object.entries(added))
                    Assertion.define(name, matcher);
            },
        });
    }
}
