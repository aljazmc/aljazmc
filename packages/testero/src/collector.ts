import Each from "./each.js";
import { type Body, type HookKind, type Mode, Suite, Test } from "./suite.js";

type TestFunction = (name: string, body?: Body, timeout?: number) => void;
type DescribeFunction = (name: string, body: () => unknown) => void;
type Table = (table: unknown, ...values: unknown[]) => unknown;

/** `test` and `it`, with `only`, `skip`, `todo` and `each`. */
export interface TestApi extends TestFunction {
    only: TestFunction & { each: Table };
    skip: TestFunction & { each: Table };
    todo: (name: string) => void;
    each: Table;
}

/** `describe`, with `only`, `skip` and `each`. */
export interface DescribeApi extends DescribeFunction {
    only: DescribeFunction & { each: Table };
    skip: DescribeFunction & { each: Table };
    each: Table;
}

/** Collects what a test file declares into a tree of suites. */
export default class Collector {
    readonly root = new Suite("");
    #current = this.root;
    #closed = false;

    readonly describe: DescribeApi = this.#describes();
    readonly test: TestApi = this.#tests();

    /** Ends collection, tests cannot be declared while tests run. */
    close(): void {
        this.#closed = true;
    }

    /** `beforeAll`, `afterAll`, `beforeEach` or `afterEach`. */
    readonly hook =
        (kind: HookKind) =>
        (body: Body, timeout?: number): void => {
            this.#open(kind);
            this.#current.hooks[kind].push({ body, timeout });
        };

    #describes(): DescribeApi {
        const describe = (mode: Mode) => (name: string, body: () => unknown) =>
            this.#describe(name, body, mode);
        const each =
            (mode: Mode) =>
            (table: unknown, ...values: unknown[]) =>
            (name: string, body: (...args: unknown[]) => unknown) => {
                for (const [index, row] of Each.rows(table, values).entries())
                    this.#describe(
                        Each.title(String(name), row, index),
                        () => body(...row),
                        mode,
                    );
            };
        return Object.assign(describe("run"), {
            only: Object.assign(describe("only"), { each: each("only") }),
            skip: Object.assign(describe("skip"), { each: each("skip") }),
            each: each("run"),
        });
    }

    #tests(): TestApi {
        const test =
            (mode: Mode): TestFunction =>
            (name, body, timeout) =>
                this.#test(name, body, mode, timeout);
        const each =
            (mode: Mode) =>
            (table: unknown, ...values: unknown[]) =>
            (
                name: string,
                body: (...args: unknown[]) => unknown,
                timeout?: number,
            ) => {
                for (const [index, row] of Each.rows(table, values).entries())
                    this.#test(
                        Each.title(String(name), row, index),
                        () => body(...row),
                        mode,
                        timeout,
                    );
            };
        return Object.assign(test("run"), {
            only: Object.assign(test("only"), { each: each("only") }),
            skip: Object.assign(test("skip"), { each: each("skip") }),
            todo: (name: string) =>
                this.#test(name, undefined, "todo", undefined),
            each: each("run"),
        });
    }

    #describe(name: string, body: () => unknown, mode: Mode): void {
        this.#open("describe");
        const suite = new Suite(String(name), mode, this.#current);
        this.#current.children.push(suite);

        const outer = this.#current;
        this.#current = suite;
        try {
            const result = body();
            if (result instanceof Promise)
                throw new Error(
                    `describe "${suite.name}" returned a promise, its tests must be declared synchronously.`,
                );
        } finally {
            this.#current = outer;
        }
    }

    #test(
        name: string,
        body: Body | undefined,
        mode: Mode,
        timeout: number | undefined,
    ): void {
        this.#open("test");
        if (mode !== "todo" && typeof body !== "function")
            throw new TypeError(`test "${name}" needs a function.`);
        this.#current.children.push(
            new Test(String(name), body, mode, timeout, this.#current),
        );
    }

    #open(what: string): void {
        if (this.#closed)
            throw new Error(
                `Cannot declare ${what} while tests run, declare it at the top level or in describe.`,
            );
    }
}
