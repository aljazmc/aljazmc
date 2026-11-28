/**
 * The functions test files use, exported for them to import, and declared
 * as globals by `ambient.ts`.
 */
import type { DescribeApi, TestApi } from "./collector.js";
import type Expect from "./expect/expect.js";
import type Mocks from "./mock.js";
import type { Body } from "./suite.js";

export type Hook = (body: Body, timeout?: number) => void;

/** `testero` and `jest`, their methods return them to chain calls. */
export interface Testero {
    fn: typeof Mocks.fn;
    spyOn: typeof Mocks.spyOn;
    isMockFunction: typeof Mocks.isMockFunction;
    clearAllMocks(): Testero;
    resetAllMocks(): Testero;
    restoreAllMocks(): Testero;
    /** Sets the timeout of the tests and hooks of this file. */
    setTimeout(timeout: number): Testero;
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
