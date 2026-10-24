![Custom](https://img.shields.io/badge/project_status-barely_working-yellow) ![Custom](https://img.shields.io/badge/breaking_changes-common-red) ![NPM Downloads](https://img.shields.io/npm/dm/%40aljazmc%2Ftestero) ![GitHub package.json version](https://img.shields.io/github/package-json/v/aljazmc/aljazmc?filename=packages%2Ftestero%2Fpackage.json&color=green) ![GitHub License](https://img.shields.io/github/license/aljazmc/aljazmc)

# > testero

A simple, Jest-like test runner. Easy to understand, easy to customize and easy to extend.

## > usage

```sh
testero                    # run every test file
testero math unit/         # run test files whose path matches a pattern
testero -t "adds numbers"  # run tests whose full name matches
testero --verbose --bail   # list every test, stop at the first failing file
testero --listTests        # print the test files instead of running them
testero --config           # write the defaults to testero.config.ts, --config js to testero.config.js
testero --help
```

Test files are written like for [Jest](https://jestjs.io), in JavaScript, TypeScript or JSX, with the same globals:

```ts
import { add } from "../src/math.ts";

describe("add", () => {
    beforeEach(() => testero.clearAllMocks()); // `jest` works too

    test("adds numbers", () => {
        expect(add(1, 2)).toBe(3);
    });

    test.each([
        [1, 1, 2],
        [2, 2, 4],
    ])("%i + %i = %i", (a, b, sum) => {
        expect(add(a, b)).toBe(sum);
    });

    test("calls back", async () => {
        const callback = testero.fn().mockResolvedValue("done");
        await expect(callback()).resolves.toBe("done");
        expect(callback).toHaveBeenCalledTimes(1);
    });
});
```

- `describe`, `test` and `it`, with `.only`, `.skip`, `.each` and `test.todo`, also `fdescribe`, `xdescribe`, `fit`, `xit` and `xtest`
- `beforeAll`, `afterAll`, `beforeEach` and `afterEach`; tests and hooks may return promises or take a `done` callback, and time out
- `expect` with Jest's matchers, `.not`, `.resolves`, `.rejects`, `expect.extend`, `expect.assertions` and `expect.hasAssertions`
- asymmetric matchers: `expect.any`, `expect.anything`, `expect.objectContaining`, `expect.arrayContaining`, `expect.stringContaining`, `expect.stringMatching`, `expect.closeTo` and their `expect.not` variants
- `testero.fn`, `testero.spyOn`, `testero.clearAllMocks`, `testero.resetAllMocks`, `testero.restoreAllMocks` and `testero.setTimeout`, also as `jest`; imports from `@jest/globals` get the same functions

Failures show the message, a diff of expected and received values, and the code where they happened.

Settings follow Jest's names and defaults. Override them with `testero.config.ts` or `testero.config.js` in the current directory; objects are merged deeply, anything else (like `ignore`) replaces the default:

```js
export default {
    ignore: [".git", "node_modules"],
    rules: {
        // globs of test files in order, the last match decides, "!" excludes
        testMatch: [
            "**/__tests__/**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}",
            "**/*.{spec,test}.{js,jsx,ts,tsx,mjs,cjs,mts,cts}",
        ],
        testTimeout: 5000, // milliseconds a test or hook may take
        bail: false, // stop after the first failing test file
        verbose: false, // list every test
        passWithNoTests: false, // succeed when there are no test files
        clearMocks: false, // clear the calls of every mock before each test
        resetMocks: false, // also remove their implementations
        restoreMocks: false, // also restore spies to the originals
    },
};
```

## > how it works

- `src/transformer.ts`: bundles each test file and the local files it imports with [esbuild](https://esbuild.github.io), the only dependency, into one module; installed packages stay external and the globals are injected where the file uses them
- `src/collector.ts`: the `describe`, `test` and hook functions, collecting what a test file declares into a tree of suites (`src/suite.ts`)
- `src/runner.ts`: runs the tests of the tree in order, with focus, skips, hooks, timeouts and `done` callbacks
- `src/expect`: the `expect` function, its matchers, deep equality and value printing with diffs
- `src/mock.ts`: mock functions and spies
- `src/reporter.ts`: prints results like Jest's default reporter
- `src/testero.ts`: finds the test files and runs them one after another
- `@aljazmc/config` (`shared/config`): loads `testero.config.ts`, finds the files and matches `testMatch`, shared with every package

Each test file is bundled on its own, so it gets fresh copies of the files it imports, and spies are restored after it. Test files run one after another in one process, without workers, module mocking, fake timers, snapshots or coverage.
