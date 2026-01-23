import {
    type Body,
    type Hook,
    type HookKind,
    Suite,
    type Test,
} from "./suite.js";

export type Status = "passed" | "failed" | "skipped" | "todo";

export interface Result {
    test: Test;
    status: Status;
    /** Milliseconds the test took with its hooks. */
    duration: number;
    errors: unknown[];
}

export interface Settings {
    /** Milliseconds a test or hook may take, unless it sets its own. */
    timeout: number;
    /** Runs only the tests whose full name matches. */
    namePattern?: RegExp | undefined;
    /** Called before each test runs, like resetting mocks. */
    beforeTest?: (test: Test) => void;
    /** Called after each test, returns more errors, like missed assertion counts. */
    afterTest?: (test: Test) => unknown[];
}

/** Runs the tests of a suite tree in order, with their hooks and timeouts. */
export default class Runner {
    readonly #settings: Settings;
    #focused = false;

    constructor(settings: Settings) {
        this.#settings = settings;
    }

    /** Results of every test, and errors of `afterAll` hooks that belong to no test. */
    async run(root: Suite): Promise<{ results: Result[]; errors: unknown[] }> {
        this.#focused = [...root.tests()].some((test) => test.focused);
        const results: Result[] = [];
        const errors: unknown[] = [];
        await this.#suite(root, [], results, errors);
        return { results, errors };
    }

    /** Whether a test runs: not skipped, focused when others are, matching the name pattern. */
    runs(test: Test): boolean {
        return (
            !test.skipped &&
            (!this.#focused || test.focused) &&
            (this.#settings.namePattern?.test(test.fullName) ?? true)
        );
    }

    async #suite(
        suite: Suite,
        failed: unknown[],
        results: Result[],
        errors: unknown[],
    ): Promise<void> {
        // suites without tests to run do not run their hooks either
        if (![...suite.tests()].some((test) => this.runs(test))) {
            for (const test of suite.tests()) results.push(Runner.#skip(test));
            return;
        }

        const setup = [...failed];
        if (setup.length === 0)
            for (const hook of suite.hooks.beforeAll) {
                const error = await this.#call(hook.body, hook.timeout);
                if (error !== undefined) {
                    setup.push(error);
                    break;
                }
            }

        for (const child of suite.children)
            if (child instanceof Suite)
                await this.#suite(child, setup, results, errors);
            else await this.#test(child, setup, results);

        if (failed.length === 0)
            for (const hook of suite.hooks.afterAll) {
                const error = await this.#call(hook.body, hook.timeout);
                if (error !== undefined) errors.push(error);
            }
    }

    async #test(
        test: Test,
        failed: unknown[],
        results: Result[],
    ): Promise<void> {
        if (!this.runs(test)) {
            results.push(Runner.#skip(test));
            return;
        }

        const start = performance.now();
        const errors = [...failed];
        if (errors.length === 0) {
            this.#settings.beforeTest?.(test);

            for (const hook of Runner.#hooks(test, "beforeEach")) {
                const error = await this.#call(hook.body, hook.timeout);
                if (error !== undefined) {
                    errors.push(error);
                    break;
                }
            }
            if (errors.length === 0 && test.body) {
                const error = await this.#call(test.body, test.timeout);
                if (error !== undefined) errors.push(error);
            }
            for (const hook of Runner.#hooks(test, "afterEach").reverse()) {
                const error = await this.#call(hook.body, hook.timeout);
                if (error !== undefined) errors.push(error);
            }

            errors.push(...(this.#settings.afterTest?.(test) ?? []));
        }

        results.push({
            test,
            status: errors.length > 0 ? "failed" : "passed",
            duration: performance.now() - start,
            errors,
        });
    }

    /** Hooks of a kind from the outermost suite to the test's own. */
    static #hooks(test: Test, kind: HookKind): Hook[] {
        return test.suite.path.flatMap((suite) => suite.hooks[kind]);
    }

    static #skip(test: Test): Result {
        return {
            test,
            status: test.mode === "todo" ? "todo" : "skipped",
            duration: 0,
            errors: [],
        };
    }

    /** Calls a body within its timeout, returning what it threw, or undefined. */
    async #call(
        body: Body,
        timeout = this.#settings.timeout,
    ): Promise<unknown> {
        let timer: NodeJS.Timeout | undefined;
        const expired = new Promise((_, reject) => {
            timer = setTimeout(
                () =>
                    reject(
                        new Error(
                            `Exceeded timeout of ${timeout} ms for a test or hook.`,
                        ),
                    ),
                timeout,
            );
        });

        try {
            await Promise.race([Runner.#invoke(body), expired]);
            return undefined;
        } catch (error) {
            return error ?? new Error(`${String(error)} was thrown`);
        } finally {
            clearTimeout(timer);
        }
    }

    /** Runs a body as a promise, with a `done` callback when it takes one. */
    static #invoke(body: Body): Promise<unknown> {
        if (body.length === 0)
            return new Promise((resolve) => resolve(body(() => {})));
        return new Promise((resolve, reject) => {
            body((error?: unknown) =>
                error === undefined ? resolve(undefined) : reject(error),
            );
        });
    }
}
