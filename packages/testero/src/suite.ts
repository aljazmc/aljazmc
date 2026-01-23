/** How a test or suite was declared: `test`, `test.only`, `test.skip` or `test.todo`. */
export type Mode = "run" | "only" | "skip" | "todo";

/** A test or hook body: it may return a promise or take a `done` callback. */
export type Body = (done: (error?: unknown) => void) => unknown;

export type HookKind = "beforeAll" | "afterAll" | "beforeEach" | "afterEach";

export interface Hook {
    body: Body;
    timeout: number | undefined;
}

/** A `describe` block, with its tests, nested suites and hooks in declaration order. */
export class Suite {
    readonly name: string;
    readonly mode: Mode;
    readonly parent: Suite | undefined;
    readonly children: (Suite | Test)[] = [];
    readonly hooks: Record<HookKind, Hook[]> = {
        beforeAll: [],
        afterAll: [],
        beforeEach: [],
        afterEach: [],
    };

    constructor(name: string, mode: Mode = "run", parent?: Suite) {
        this.name = name;
        this.mode = mode;
        this.parent = parent;
    }

    /** The names of the suites from the file down to this one, the file has none. */
    get titles(): string[] {
        return this.parent ? [...this.parent.titles, this.name] : [];
    }

    /** This suite and the ones around it, from the file down. */
    get path(): Suite[] {
        return this.parent ? [...this.parent.path, this] : [this];
    }

    /** Every test, of nested suites too, in order. */
    *tests(): Generator<Test> {
        for (const child of this.children)
            if (child instanceof Test) yield child;
            else yield* child.tests();
    }
}

/** A named test body in a suite. */
export class Test {
    readonly name: string;
    readonly body: Body | undefined;
    readonly mode: Mode;
    readonly timeout: number | undefined;
    readonly suite: Suite;

    constructor(
        name: string,
        body: Body | undefined,
        mode: Mode,
        timeout: number | undefined,
        suite: Suite,
    ) {
        this.name = name;
        this.body = body;
        this.mode = mode;
        this.timeout = timeout;
        this.suite = suite;
    }

    /** The names of the suites around the test, and its own. */
    get titles(): string[] {
        return [...this.suite.titles, this.name];
    }

    /** The titles joined like Jest does for `-t`. */
    get fullName(): string {
        return this.titles.join(" ");
    }

    /** Whether the test, or a suite around it, is marked with `only`. */
    get focused(): boolean {
        return (
            this.mode === "only" ||
            this.suite.path.some((suite) => suite.mode === "only")
        );
    }

    /** Whether the test, or a suite around it, is skipped or todo. */
    get skipped(): boolean {
        return (
            this.mode === "skip" ||
            this.mode === "todo" ||
            this.suite.path.some((suite) => suite.mode === "skip")
        );
    }
}
