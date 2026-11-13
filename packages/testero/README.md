![Custom](https://img.shields.io/badge/project_status-mostly_working-green) ![Custom](https://img.shields.io/badge/breaking_changes-common-red) ![NPM Downloads](https://img.shields.io/npm/dm/%40aljazmc%2Ftestero) ![GitHub package.json version](https://img.shields.io/github/package-json/v/aljazmc/aljazmc?filename=packages%2Ftestero%2Fpackage.json&color=green) ![GitHub License](https://img.shields.io/github/license/aljazmc/aljazmc)

# > testero

A simple, [Jest](https://jestjs.io)-like test runner for JavaScript, JSX
and TypeScript, compiling tests with [esbuild](https://esbuild.github.io),
its only dependency. Easy to understand, easy to customize and easy to
extend.

## > Features

| Feature            | Description                                                             |
| ------------------ | ----------------------------------------------------------------------- |
| Async tests        | Tests and hooks may return promises or take a `done` callback.          |
| Isolation          | Each file is bundled on its own, with fresh imports and restored spies. |
| Jest compatibility | Same globals, matchers and config names, `@jest/globals` imports work.  |
| Mocks              | `fn`, `spyOn` and clearing, resetting and restoring of all mocks.       |
| Readable failures  | Message, diff of expected and received values, and the failing code.    |
| TypeScript types   | `@aljazmc/testero/globals` replaces `@types/jest`.                      |

## > Install

```sh
npm install --save-dev @aljazmc/testero
```

Requires Node.js 22.18+, 24.2+, 25 or 26.

## > Usage

| Command                 | Description                                         |
| ----------------------- | --------------------------------------------------- |
| `testero`               | Runs every test file.                               |
| `testero <pattern>…`    | Runs the test files whose path matches a pattern.   |
| `testero --bail`        | Stops at the first failing file.                    |
| `testero --config [js]` | Writes the defaults to `testero.config.ts` (`.js`). |
| `testero --help`        | Shows every option.                                 |
| `testero --listTests`   | Prints the test files instead of running them.      |
| `testero --verbose`     | Lists every test.                                   |
| `testero -t <name>`     | Runs the tests whose full name matches.             |

## > Writing tests

```ts
import { add } from "../src/math.ts";

describe("add", () => {
    beforeEach(() => testero.clearAllMocks()); // `jest` works too

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

| Global                                             | Description                                                           |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| `beforeAll`, `afterAll`, `beforeEach`, `afterEach` | Run code around the tests of a suite.                                 |
| `describe`, `test`, `it`                           | Suites and tests, with `.each`, `.only`, `.skip` and `test.todo`.     |
| `expect`                                           | Jest's matchers, `.not`, `.resolves`, `.rejects` and `expect.extend`. |
| `expect.any`, `expect.objectContaining`, …         | Asymmetric matchers, also as `expect.not.*`.                          |
| `fdescribe`, `fit`, `xdescribe`, `xit`, `xtest`    | Focused and skipped aliases.                                          |
| `testero`, `jest`                                  | Mocks, and `setTimeout` for the tests of a file.                      |

For the types, add `"@aljazmc/testero/globals"` to `compilerOptions.types`
in `tsconfig.json`.

## > Configuration

`testero.config.ts` (or `.js`) in the current directory overrides the
defaults, using Jest's names: objects are merged deeply, anything else,
like `ignore`, is replaced.

```js
export default {
    ignore: [".git", "node_modules"],
    rules: { clearMocks: true, testMatch: ["**/tests/**/*.test.ts"] },
};
```

| Option            | Default                           | Description                                      |
| ----------------- | --------------------------------- | ------------------------------------------------ |
| `bail`            | `false`                           | Stops after the first failing test file.         |
| `clearMocks`      | `false`                           | Clears the calls of every mock before each test. |
| `passWithNoTests` | `false`                           | Succeeds when there are no test files.           |
| `resetMocks`      | `false`                           | Also removes mock implementations.               |
| `restoreMocks`    | `false`                           | Also restores the original functions of spies.   |
| `testMatch`       | `__tests__` and `*.{spec,test}.*` | Globs of test files, the last match decides.     |
| `testTimeout`     | `5000`                            | Milliseconds a test or hook may take.            |
| `verbose`         | `false`                           | Lists every test, not only the failing ones.     |

## > How it works

```
test file
├─> src/transformer.ts   bundles it with esbuild, injecting the globals
├─> src/collector.ts     collects its suites and tests into a tree
├─> src/runner.ts        runs them, with hooks, timeouts and done callbacks
└─> src/reporter.ts      prints the results like Jest does
```

| Module               | Description                                                     |
| -------------------- | --------------------------------------------------------------- |
| `@aljazmc/config`    | Loads `testero.config.ts`, finds files and matches `testMatch`. |
| `src/collector.ts`   | Collects `describe`, `test` and hooks into a suite tree.        |
| `src/expect`         | `expect`, matchers, deep equality and value diffs.              |
| `src/mock.ts`        | Mock functions and spies.                                       |
| `src/reporter.ts`    | Prints results like Jest's default reporter.                    |
| `src/runner.ts`      | Runs tests with focus, skips, hooks and timeouts.               |
| `src/testero.ts`     | Finds test files and runs them one after another.               |
| `src/transformer.ts` | Bundles test files with esbuild, packages stay external.        |

Test files run sequentially in one process. There are no workers, module
mocks, fake timers, snapshots or coverage.

## > License

MIT, see [LICENSE](LICENSE).
