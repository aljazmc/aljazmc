/**
 * The globals of test files, for tsconfig's `types` as `@aljazmc/testero/globals`,
 * also exported for test files to import them from there.
 */
import type { DescribeApi, TestApi } from "./collector.js";
import type Expect from "./expect/expect.js";
import type Mocks from "./mock.js";
import type { Body } from "./suite.js";

type Hook = (body: Body, timeout?: number) => void;

/** `testero` and `jest`, their methods return them to chain calls. */
interface Testero {
    fn: typeof Mocks.fn;
    spyOn: typeof Mocks.spyOn;
    isMockFunction: typeof Mocks.isMockFunction;
    clearAllMocks(): Testero;
    resetAllMocks(): Testero;
    restoreAllMocks(): Testero;
    /** Sets the timeout of the tests and hooks of this file. */
    setTimeout(timeout: number): Testero;
}

declare global {
    const describe: DescribeApi;
    const fdescribe: DescribeApi["only"];
    const xdescribe: DescribeApi["skip"];
    const test: TestApi;
    const it: TestApi;
    const fit: TestApi["only"];
    const xit: TestApi["skip"];
    const xtest: TestApi["skip"];
    const beforeAll: Hook;
    const afterAll: Hook;
    const beforeEach: Hook;
    const afterEach: Hook;
    const expect: ReturnType<Expect["create"]>;
    const testero: Testero;
    const jest: Testero;
}

export declare const describe: DescribeApi;
export declare const fdescribe: DescribeApi["only"];
export declare const xdescribe: DescribeApi["skip"];
export declare const test: TestApi;
export declare const it: TestApi;
export declare const fit: TestApi["only"];
export declare const xit: TestApi["skip"];
export declare const xtest: TestApi["skip"];
export declare const beforeAll: Hook;
export declare const afterAll: Hook;
export declare const beforeEach: Hook;
export declare const afterEach: Hook;
export declare const expect: ReturnType<Expect["create"]>;
export declare const testero: Testero;
export declare const jest: Testero;
