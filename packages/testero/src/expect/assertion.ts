import { type Matcher, type MatcherContext, matchers } from "./matchers.js";

/** A failed expectation, its message says what was expected and received. */
export class AssertionError extends Error {
    override name = "AssertionError";
}

type Result = void | Promise<void>;

/** The matchers an assertion has, each throwing an AssertionError when it fails. */
export interface Matchers {
    toBe(expected: unknown): Result;
    toEqual(expected: unknown): Result;
    toStrictEqual(expected: unknown): Result;
    toMatchObject(expected: object): Result;
    toBeDefined(): Result;
    toBeUndefined(): Result;
    toBeNull(): Result;
    toBeNaN(): Result;
    toBeTruthy(): Result;
    toBeFalsy(): Result;
    toBeGreaterThan(expected: number | bigint): Result;
    toBeGreaterThanOrEqual(expected: number | bigint): Result;
    toBeLessThan(expected: number | bigint): Result;
    toBeLessThanOrEqual(expected: number | bigint): Result;
    toBeCloseTo(expected: number, digits?: number): Result;
    toBeInstanceOf(expected: unknown): Result;
    toContain(expected: unknown): Result;
    toContainEqual(expected: unknown): Result;
    toHaveLength(expected: number): Result;
    toHaveProperty(path: string | PropertyKey[], value?: unknown): Result;
    toMatch(expected: string | RegExp): Result;
    toThrow(expected?: unknown): Result;
    toHaveBeenCalled(): Result;
    toHaveBeenCalledTimes(expected: number): Result;
    toHaveBeenCalledWith(...expected: unknown[]): Result;
    toHaveBeenLastCalledWith(...expected: unknown[]): Result;
    toHaveBeenNthCalledWith(nth: number, ...expected: unknown[]): Result;
    toHaveReturned(): Result;
    toHaveReturnedTimes(expected: number): Result;
    toHaveReturnedWith(expected: unknown): Result;
    toHaveLastReturnedWith(expected: unknown): Result;
    toHaveNthReturnedWith(nth: number, expected: unknown): Result;
    [matcher: string]: unknown;
}

/** `expect(received)`, with every matcher, `.not`, `.resolves` and `.rejects`. */
export default class Assertion {
    /** Assertions made since the last reset, for `expect.assertions(n)`. */
    static count = 0;

    readonly #received: unknown;
    readonly #context: MatcherContext;

    constructor(
        received: unknown,
        context: MatcherContext = { isNot: false, promise: "" },
    ) {
        this.#received = received;
        this.#context = context;
    }

    /** The same assertion, expecting the opposite. */
    get not(): Assertion & Matchers {
        return new Assertion(this.#received, {
            ...this.#context,
            isNot: !this.#context.isNot,
        }) as Assertion & Matchers;
    }

    /** The assertion on what a promise resolves to, its matchers return promises. */
    get resolves(): Assertion & Matchers {
        return new Assertion(this.#received, {
            ...this.#context,
            promise: "resolves",
        }) as Assertion & Matchers;
    }

    /** The assertion on why a promise rejects, its matchers return promises. */
    get rejects(): Assertion & Matchers {
        return new Assertion(this.#received, {
            ...this.#context,
            promise: "rejects",
        }) as Assertion & Matchers;
    }

    /** Adds a matcher to every assertion, like `expect.extend`. */
    static define(name: string, matcher: Matcher): void {
        matchers[name] = matcher;
        Object.defineProperty(Assertion.prototype, name, {
            configurable: true,
            writable: true,
            value: function check(this: Assertion, ...args: unknown[]) {
                return this.#run(name, args, check);
            },
        });
    }

    /** Runs a matcher now, or once the promise settles for `.resolves` and `.rejects`. */
    #run(
        name: string,
        args: unknown[],
        caller: (...args: never[]) => unknown,
    ): Result {
        Assertion.count++;
        // the stack of the call site, kept for failures after awaiting
        const origin: { stack?: string } = {};
        Error.captureStackTrace(origin, caller);

        const { promise } = this.#context;
        if (!promise) return this.#check(name, this.#received, args, origin);

        const settled = (value: unknown, resolved: boolean) => {
            if (resolved === (promise === "resolves"))
                return this.#check(name, value, args, origin);
            throw Assertion.#error(
                `expect(received).${promise}.${name}()\n\nReceived promise ${resolved ? "resolved" : "rejected"} instead of ${resolved ? "rejected" : "resolved"}\n${resolved ? "Resolved" : "Rejected"} to value: ${String(value)}`,
                origin,
            );
        };
        if (
            !(this.#received instanceof Promise) &&
            typeof (this.#received as PromiseLike<unknown>)?.then !== "function"
        )
            throw Assertion.#error(
                `expect(received).${promise}.${name}()\n\nMatcher error: received value must be a promise`,
                origin,
            );
        return Promise.resolve(this.#received).then(
            (value) => settled(value, true),
            (reason) => settled(reason, false),
        );
    }

    #check(
        name: string,
        received: unknown,
        args: unknown[],
        origin: { stack?: string },
    ): void {
        const matcher = matchers[name] as Matcher;
        let result: ReturnType<Matcher>;
        try {
            result = matcher.call(this.#context, received, ...args);
        } catch (error) {
            throw Assertion.#error(
                error instanceof Error ? error.message : String(error),
                origin,
            );
        }
        if (result.pass === this.#context.isNot)
            throw Assertion.#error(result.message(), origin);
    }

    static #error(message: string, origin: { stack?: string }): AssertionError {
        const error = new AssertionError(message);
        const frames = origin.stack?.split("\n").slice(1).join("\n");
        error.stack = `${error.name}: ${message}${frames ? `\n${frames}` : ""}`;
        return error;
    }
}

for (const [name, matcher] of Object.entries(matchers))
    Assertion.define(name, matcher);
