// biome-ignore lint/suspicious/noExplicitAny: mocks stand in for functions of any signature
type Procedure = (...args: any[]) => any;

export interface MockResult {
    type: "return" | "throw" | "incomplete";
    value: unknown;
}

/** What a mock function remembers of its calls, as `fn.mock`. */
export interface MockState {
    calls: unknown[][];
    results: MockResult[];
    instances: unknown[];
    contexts: unknown[];
    lastCall: unknown[] | undefined;
}

/** A function that records its calls, with Jest's `mock*` methods. */
export interface MockFunction<T extends Procedure = Procedure> {
    (...args: Parameters<T>): ReturnType<T>;
    new (...args: Parameters<T>): ReturnType<T>;
    readonly mock: MockState;
    mockImplementation(implementation: T): this;
    mockImplementationOnce(implementation: T): this;
    mockReturnValue(value: ReturnType<T>): this;
    mockReturnValueOnce(value: ReturnType<T>): this;
    mockResolvedValue(value: Awaited<ReturnType<T>>): this;
    mockResolvedValueOnce(value: Awaited<ReturnType<T>>): this;
    mockRejectedValue(value: unknown): this;
    mockRejectedValueOnce(value: unknown): this;
    mockReturnThis(): this;
    mockName(name: string): this;
    getMockName(): string;
    getMockImplementation(): T | undefined;
    mockClear(): this;
    mockReset(): this;
    mockRestore(): void;
}

/** One mock function: its implementations and the calls it got. */
class Mock {
    readonly function: MockFunction;
    state: MockState = Mock.#empty();
    /** What the mock does after a reset, a spy calls its original. */
    readonly #original: Procedure | undefined;
    readonly #restore: (() => void) | undefined;
    #implementation: Procedure | undefined;
    #once: Procedure[] = [];
    #name = "testero.fn()";

    constructor(implementation?: Procedure, restore?: () => void) {
        this.#original = implementation;
        this.#implementation = implementation;
        this.#restore = restore;

        const mock = this;
        const fn = function (this: unknown, ...args: unknown[]) {
            return mock.#call(this, args, new.target);
        } as unknown as MockFunction;
        Object.defineProperty(fn, "mock", { get: () => mock.state });
        this.function = Object.assign(fn, this.#methods(fn));
    }

    #methods(fn: MockFunction) {
        const set = (change: () => void) => {
            change();
            return fn;
        };
        return {
            _isMockFunction: true,
            mockImplementation: (implementation: Procedure) =>
                set(() => {
                    this.#implementation = implementation;
                }),
            mockImplementationOnce: (implementation: Procedure) =>
                set(() => this.#once.push(implementation)),
            mockReturnValue: (value: unknown) =>
                fn.mockImplementation(() => value),
            mockReturnValueOnce: (value: unknown) =>
                fn.mockImplementationOnce(() => value),
            mockResolvedValue: (value: unknown) =>
                fn.mockImplementation(() => Promise.resolve(value)),
            mockResolvedValueOnce: (value: unknown) =>
                fn.mockImplementationOnce(() => Promise.resolve(value)),
            mockRejectedValue: (value: unknown) =>
                fn.mockImplementation(() => Promise.reject(value)),
            mockRejectedValueOnce: (value: unknown) =>
                fn.mockImplementationOnce(() => Promise.reject(value)),
            mockReturnThis: () =>
                fn.mockImplementation(function (this: unknown) {
                    return this;
                }),
            mockName: (name: string) =>
                set(() => {
                    this.#name = name;
                }),
            getMockName: () => this.#name,
            getMockImplementation: () => this.#implementation,
            mockClear: () => set(() => this.clear()),
            mockReset: () => set(() => this.reset()),
            mockRestore: () => this.restore(),
        };
    }

    /** Forgets the calls. */
    clear(): void {
        this.state = Mock.#empty();
    }

    /** Forgets the calls and the implementations given since. */
    reset(): void {
        this.clear();
        this.#implementation = this.#original;
        this.#once = [];
    }

    /** Resets, and puts a spied method back. */
    restore(): void {
        this.reset();
        this.#restore?.();
    }

    #call(context: unknown, args: unknown[], target: unknown): unknown {
        const result: MockResult = { type: "incomplete", value: undefined };
        this.state.calls.push(args);
        this.state.contexts.push(context);
        this.state.instances.push(context);
        this.state.results.push(result);
        this.state.lastCall = args;

        const implementation = this.#once.shift() ?? this.#implementation;
        try {
            result.value = !implementation
                ? undefined
                : target
                  ? Reflect.construct(implementation, args, target as Procedure)
                  : implementation.apply(context, args);
            result.type = "return";
            return result.value;
        } catch (error) {
            result.type = "throw";
            result.value = error;
            throw error;
        }
    }

    static #empty(): MockState {
        return {
            calls: [],
            results: [],
            instances: [],
            contexts: [],
            lastCall: undefined,
        };
    }
}

/** Creates mock functions and spies, and clears, resets or restores them all at once. */
// biome-ignore lint/complexity/noStaticOnlyClass: keeps every mock of a run
export default class Mocks {
    static readonly #all = new Map<MockFunction, Mock>();

    /** A mock function, doing what an implementation does, if given. */
    static fn<T extends Procedure>(implementation?: T): MockFunction<T> {
        const mock = new Mock(implementation);
        Mocks.#all.set(mock.function, mock);
        return mock.function as MockFunction<T>;
    }

    /** Replaces a method with a mock that calls it, until restored. */
    static spyOn<T extends object, K extends keyof T>(
        object: T,
        method: K,
    ): MockFunction {
        const original = object[method];
        if (Mocks.isMockFunction(original)) return original;
        if (typeof original !== "function")
            throw new TypeError(
                `Cannot spy on ${String(method)}, it is ${typeof original}, not a function.`,
            );

        const own = Object.hasOwn(object, method);
        const mock = new Mock(
            function (this: unknown, ...args: unknown[]) {
                return original.apply(this, args);
            },
            () => {
                if (own) object[method] = original;
                else delete object[method];
            },
        );
        object[method] = mock.function as T[K];
        Mocks.#all.set(mock.function, mock);
        return mock.function;
    }

    static isMockFunction(value: unknown): value is MockFunction {
        return (
            typeof value === "function" &&
            (value as { _isMockFunction?: unknown })._isMockFunction === true
        );
    }

    static clearAll(): void {
        for (const mock of Mocks.#all.values()) mock.clear();
    }

    static resetAll(): void {
        for (const mock of Mocks.#all.values()) mock.reset();
    }

    static restoreAll(): void {
        for (const mock of Mocks.#all.values()) mock.restore();
    }

    /** Forgets every mock, between test files. */
    static forget(): void {
        Mocks.#all.clear();
    }
}
