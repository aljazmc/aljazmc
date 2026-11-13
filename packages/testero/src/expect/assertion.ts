import {
    type Matcher,
    type MatcherContext,
    type MatcherResult,
    matchers,
} from "./matchers.js";

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
        return this.#with({ isNot: !this.#context.isNot });
    }

    /** The assertion on what a promise resolves to, its matchers return promises. */
    get resolves(): Assertion & Matchers {
        return this.#with({ promise: "resolves" });
    }

    /** The assertion on why a promise rejects, its matchers return promises. */
    get rejects(): Assertion & Matchers {
        return this.#with({ promise: "rejects" });
    }

    /** The same received value with another context, of the same class to keep its matchers. */
    #with(change: Partial<MatcherContext>): Assertion & Matchers {
        const Same = this.constructor as new (
            received: unknown,
            context: MatcherContext,
        ) => Assertion;
        return new Same(this.#received, {
            ...this.#context,
            ...change,
        }) as Assertion & Matchers;
    }

    /**
     * Adds a matcher to the assertions of a class: Assertion itself for the
     * built in ones, the class of one test file for `expect.extend`.
     */
    static define(
        target: typeof Assertion,
        name: string,
        matcher: Matcher,
    ): void {
        Object.defineProperty(target.prototype, name, {
            configurable: true,
            writable: true,
            value: function check(this: Assertion, ...args: unknown[]) {
                return this.#run(name, matcher, args, check);
            },
        });
    }

    /** Runs a matcher now, or once the promise settles for `.resolves` and `.rejects`. */
    #run(
        name: string,
        matcher: Matcher,
        args: unknown[],
        caller: (...args: never[]) => unknown,
    ): Result {
        Assertion.count++;
        // the stack of the call site, kept for failures after awaiting
        const origin: { stack?: string } = {};
        Error.captureStackTrace(origin, caller);

        const { promise } = this.#context;
        if (!promise) return this.#check(matcher, this.#received, args, origin);

        const settled = (value: unknown, resolved: boolean) => {
            if (resolved === (promise === "resolves"))
                return this.#check(matcher, value, args, origin);
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

    /** Calls a matcher, and fails when it does not pass, after awaiting an async one. */
    #check(
        matcher: Matcher,
        received: unknown,
        args: unknown[],
        origin: { stack?: string },
    ): Result {
        const failed = (error: unknown) =>
            Assertion.#error(
                error instanceof Error ? error.message : String(error),
                origin,
            );
        let result: ReturnType<Matcher>;
        try {
            result = matcher.call(this.#context, received, ...args);
        } catch (error) {
            throw failed(error);
        }
        if (typeof (result as PromiseLike<unknown>)?.then === "function")
            return Promise.resolve(result).then(
                (settled) => this.#verdict(settled, origin),
                (error) => {
                    throw failed(error);
                },
            );
        return this.#verdict(result as MatcherResult, origin);
    }

    /** Throws when a matcher result is not what the assertion expects. */
    #verdict(result: MatcherResult, origin: { stack?: string }): void {
        if (Boolean(result?.pass) === this.#context.isNot)
            throw Assertion.#error(
                typeof result?.message === "function"
                    ? String(result.message())
                    : "The matcher did not return a result with pass and message.",
                origin,
            );
    }

    static #error(message: string, origin: { stack?: string }): AssertionError {
        const error = new AssertionError(message);
        const frames = origin.stack?.split("\n").slice(1).join("\n");
        error.stack = `${error.name}: ${message}${frames ? `\n${frames}` : ""}`;
        return error;
    }
}

for (const [name, matcher] of Object.entries(matchers))
    Assertion.define(Assertion, name, matcher);
