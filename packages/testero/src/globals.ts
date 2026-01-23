import type Collector from "./collector.js";
import type Expect from "./expect/expect.js";
import Mocks from "./mock.js";
import type { Settings } from "./runner.js";

/** The functions test files use as globals, injected into them by the transformer. */
// biome-ignore lint/complexity/noStaticOnlyClass: groups the globals of test files
export default class Globals {
    static readonly key = Symbol.for("testero");

    static readonly names = [
        "describe",
        "fdescribe",
        "xdescribe",
        "test",
        "it",
        "fit",
        "xit",
        "xtest",
        "beforeAll",
        "afterAll",
        "beforeEach",
        "afterEach",
        "expect",
        "testero",
        "jest",
    ];

    /** The module the transformer injects, it reads the globals of the file being run. */
    static source(): string {
        return [
            'const globals = globalThis[Symbol.for("testero")];',
            ...Globals.names.map(
                (name) => `export const ${name} = globals.${name};`,
            ),
        ].join("\n");
    }

    /** Sets the globals for the next test file to import. */
    static install(
        collector: Collector,
        expect: Expect,
        settings: Settings,
    ): void {
        const { describe, test } = collector;
        const testero = {
            fn: Mocks.fn,
            spyOn: Mocks.spyOn,
            isMockFunction: Mocks.isMockFunction,
            clearAllMocks: () => {
                Mocks.clearAll();
                return testero;
            },
            resetAllMocks: () => {
                Mocks.resetAll();
                return testero;
            },
            restoreAllMocks: () => {
                Mocks.restoreAll();
                return testero;
            },
            /** Sets the timeout of the tests and hooks of this file. */
            setTimeout: (timeout: number) => {
                settings.timeout = timeout;
                return testero;
            },
        };

        (globalThis as Record<symbol, unknown>)[Globals.key] = {
            describe,
            fdescribe: describe.only,
            xdescribe: describe.skip,
            test,
            it: test,
            fit: test.only,
            xit: test.skip,
            xtest: test.skip,
            beforeAll: collector.hook("beforeAll"),
            afterAll: collector.hook("afterAll"),
            beforeEach: collector.hook("beforeEach"),
            afterEach: collector.hook("afterEach"),
            expect: expect.create(),
            testero,
            jest: testero,
        };
    }
}
