/**
 * The globals of test files, for tsconfig's `types` as `@aljazmc/testero/globals`,
 * also exported for test files to import them from there.
 */
import type * as api from "./api.js";

declare global {
    const describe: typeof api.describe;
    const fdescribe: typeof api.fdescribe;
    const xdescribe: typeof api.xdescribe;
    const test: typeof api.test;
    const it: typeof api.it;
    const fit: typeof api.fit;
    const xit: typeof api.xit;
    const xtest: typeof api.xtest;
    const beforeAll: typeof api.beforeAll;
    const afterAll: typeof api.afterAll;
    const beforeEach: typeof api.beforeEach;
    const afterEach: typeof api.afterEach;
    const expect: typeof api.expect;
    const testero: typeof api.testero;
    const jest: typeof api.jest;
}

export * from "./api.js";
