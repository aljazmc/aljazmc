![Custom](https://img.shields.io/badge/project_status-mostly_working-green) ![Custom](https://img.shields.io/badge/breaking_changes-common-red) ![NPM Downloads](https://img.shields.io/npm/dm/%40aljazmc%2Ftestero) ![GitHub package.json version](https://img.shields.io/github/package-json/v/aljazmc/aljazmc?filename=packages%2Ftestero%2Fpackage.json&color=green) ![GitHub License](https://img.shields.io/github/license/aljazmc/aljazmc)

# testero

A simple, [Jest](https://jestjs.io)-like test runner for JavaScript,
TypeScript and JSX, compiling tests with [esbuild](https://esbuild.github.io).
Easy to understand, easy to customize and easy to extend.

## Install

```sh
npm install --save-dev @aljazmc/testero
```

testero needs Node.js 22.18 or later, or 24.2 or later.

## Usage

```sh
testero                    # run every test file
testero math unit/         # run the test files whose path matches a pattern
testero -t "adds numbers"  # run the tests whose full name matches
testero --verbose --bail   # list every test, stop at the first failing file
testero --listTests        # print the test files instead of running them
testero --config           # write the defaults to testero.config.ts, --config js to testero.config.js
testero --help             # show every option
```

## Writing tests

Test files are written in JavaScript, TypeScript or JSX, with the same
globals as Jest:

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

| Globals | What they do |
|---|---|
| `describe`, `test`, `it` | Declare suites and tests, with `.only`, `.skip` and `.each`, and `test.todo`. `fdescribe`, `xdescribe`, `fit`, `xit` and `xtest` work too. |
| `beforeAll`, `afterAll`, `beforeEach`, `afterEach` | Run code around the tests of a suite. |
| `expect` | Asserts with Jest's matchers, `.not`, `.resolves` and `.rejects`, and has `expect.extend`, `expect.assertions` and `expect.hasAssertions`. |
| `expect.any`, `expect.anything`, `expect.objectContaining`, `expect.arrayContaining`, `expect.stringContaining`, `expect.stringMatching`, `expect.closeTo` | Asymmetric matchers, also as `expect.not.*`. |
| `testero`, `jest` | Mocks: `fn`, `spyOn`, `clearAllMocks`, `resetAllMocks` and `restoreAllMocks`, and `setTimeout` for the tests of a file. |

Tests and hooks may return promises or take a `done` callback, and they
time out. Imports from `@jest/globals` get the same functions.

Each failure is reported with its message, a diff of the expected and
received values, and the code where it happened.

### TypeScript

For the types of the globals, add `@aljazmc/testero/globals` to the
`types` of your `tsconfig.json`, instead of `@types/jest`:

```json
{
    "compilerOptions": {
        "types": ["node", "@aljazmc/testero/globals"]
    }
}
```

## Configuration

testero reads `testero.config.ts` or `testero.config.js` from the
current directory, with Jest's names and defaults. Objects are merged
deeply into the defaults, and anything else, like `ignore`, replaces
them:

```js
export default {
    ignore: [".git", "node_modules"],
    rules: {
        testMatch: ["**/tests/**/*.test.ts"],
        clearMocks: true,
    },
};
```

`ignore` lists the files and folders that are never searched for tests.
The `rules` are:

| Option | Default | What it does |
|---|---|---|
| `testMatch` | `["**/__tests__/**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}", "**/*.{spec,test}.{js,jsx,ts,tsx,mjs,cjs,mts,cts}"]` | Globs of the test files, in order. The last match decides, and `!` excludes. |
| `testTimeout` | `5000` | The milliseconds a test or hook may take. |
| `bail` | `false` | Stops after the first failing test file. |
| `verbose` | `false` | Lists every test, not only the failing ones. |
| `passWithNoTests` | `false` | Succeeds when there are no test files. |
| `clearMocks` | `false` | Clears the calls of every mock before each test. |
| `resetMocks` | `false` | Also removes their implementations. |
| `restoreMocks` | `false` | Also restores the original functions of spies. |

## How it works

```
test file
├─> src/transformer.ts   bundles it with esbuild, injecting the globals
├─> src/collector.ts     collects its suites and tests into a tree
├─> src/runner.ts        runs them, with hooks, timeouts and done callbacks
└─> src/reporter.ts      prints the results like Jest does
```

- `src/transformer.ts` bundles each test file and the local files it imports into one module with esbuild, the only dependency. Installed packages stay external, and the globals are injected where the file uses them.
- `src/collector.ts` holds the `describe`, `test` and hook functions, collecting what a test file declares into a tree of suites (`src/suite.ts`).
- `src/runner.ts` runs the tests of the tree in order, with focus, skips, hooks, timeouts and `done` callbacks.
- `src/expect` holds the `expect` function, its matchers, deep equality, and printing values with diffs.
- `src/mock.ts` holds mock functions and spies.
- `src/reporter.ts` prints the results like Jest's default reporter.
- `src/testero.ts` finds the test files and runs them one after another.
- `@aljazmc/config` (`shared/config`) loads `testero.config.ts`, finds the files and matches `testMatch`, and is shared with every package.

Each test file is bundled on its own, so it gets fresh copies of the
files it imports, and its spies are restored after it. Test files run
one after another in one process. There are no workers, module mocks,
fake timers, snapshots or coverage.

## License

MIT, see [LICENSE](LICENSE).
