# testero

[![CI](https://github.com/aljazmc/aljazmc/actions/workflows/ci.yml/badge.svg)](https://github.com/aljazmc/aljazmc/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@aljazmc/testero?logo=npm&color=cb3837)](https://www.npmjs.com/package/@aljazmc/testero)
[![npm downloads](https://img.shields.io/npm/dm/@aljazmc/testero?logo=npm&color=cb3837&label=downloads)](https://www.npmjs.com/package/@aljazmc/testero)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/node/v/@aljazmc/testero?logo=nodedotjs&logoColor=white&color=5fa04e)](https://nodejs.org/)
[![Dependencies: esbuild only](https://img.shields.io/badge/dependencies-esbuild%20only-ffcf00?logo=esbuild&logoColor=black)](https://esbuild.github.io/)
[![Jest compatible](https://img.shields.io/badge/Jest-compatible-c21325?logo=jest&logoColor=white)](https://jestjs.io/)
[![Tests](https://img.shields.io/badge/tests-59%20passing-brightgreen)](#tests)
[![TypeScript 7](https://img.shields.io/badge/TypeScript-7%20strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

A [Jest](https://jestjs.io)-like test runner for JavaScript, JSX and
TypeScript, written in TypeScript. It compiles tests with
[esbuild](https://esbuild.github.io), its only third-party dependency, and
speaks Jest's globals, matchers, mocks and config names, so Jest suites
without module mocks, fake timers or snapshots run as they are.

```sh
npx @aljazmc/testero --coverage
```

## Features

- **Jest's API.** `describe`, `test`, `expect` with Jest's matchers,
  asymmetric matchers, `.each`, `.only`, `.skip`, hooks and `jest.fn`,
  under the same names.
- **TypeScript and JSX out of the box.** Every test file is bundled by
  esbuild, with no Babel or ts-jest to set up.
- **Coverage.** Lines and functions the tests ran, from V8 and source
  maps, as a table and `lcov.info`.
- **Watch mode.** Reruns the tests a change concerns, following imports.
- **Readable failures.** The message, a diff of the expected and received
  values, and the failing line of code.
- **Self-hosted.** It runs all 2,141 tests of this repository, its own
  included.

| Feature            | Description                                                             |
| ------------------ | ----------------------------------------------------------------------- |
| Async tests        | Tests and hooks may return promises or take a `done` callback.          |
| Coverage           | Lines and functions the tests ran, from V8, as a table and `lcov.info`. |
| Isolation          | Each file is bundled on its own, with fresh imports and restored spies. |
| Jest compatibility | Same globals, matchers and config names.                                |
| Mocks              | `fn`, `spyOn` and clearing, resetting and restoring of all mocks.       |
| Readable failures  | Message, diff of expected and received values, and the failing code.    |
| TypeScript types   | `@aljazmc/testero/globals` replaces `@types/jest`.                      |
| Watch mode         | Reruns the tests of changed files, or all of them, as files change.     |

## Quick start

```sh
npm install --save-dev @aljazmc/testero
npx testero --config     # writes the defaults to testero.config.ts
npx testero              # runs every test file
npx testero --watch      # reruns the tests a change concerns
```

Requires Node.js 22.18+, 24.2+, 25 or 26.

## Usage

| Command                 | Description                                         |
| ----------------------- | --------------------------------------------------- |
| `testero`               | Runs every test file.                               |
| `testero <pattern>…`    | Runs the test files whose path matches a pattern.   |
| `testero --bail`        | Stops at the first failing file.                    |
| `testero --config [js]` | Writes the defaults to `testero.config.ts` (`.js`). |
| `testero --coverage`    | Also reports the coverage of the sources.           |
| `testero --help`        | Shows every option.                                 |
| `testero --listTests`   | Prints the test files instead of running them.      |
| `testero --verbose`     | Lists every test.                                   |
| `testero -t <name>`     | Runs the tests whose full name matches.             |
| `testero --watch`       | Reruns the tests a changed file concerns.           |
| `testero --watchAll`    | Reruns all tests when a file changes.               |

`--watch` reruns a changed test file, and the ones that import a changed
file, directly or not; `--watchAll` reruns every test file. Both run all
of them first, then on changes to sources and JSON files that are not
ignored. Each run is a process of its own, a change during a run restarts
it. Press `a` to run all tests, Enter to run the last ones again and `q`
to quit.

`--coverage` prints the lines and functions of each source the tests ran,
and writes them to `lcov.info` in `coverageDirectory`. Test files and
installed packages are left out; `collectCoverageFrom` limits the sources
and adds the ones no test loads.

```text
---------------|---------|---------|------------------
File           | % Funcs | % Lines | Uncovered Line #s
---------------|---------|---------|------------------
All files      |   66.66 |      50 |
 src/branch.ts |      50 |   44.44 | 3-4,7-9
 src/math.ts   |     100 |     100 |
---------------|---------|---------|------------------
```

## Writing tests

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
in `tsconfig.json`, or import the globals from it in test files:

```ts
import { describe, expect, jest, test } from "@aljazmc/testero/globals";
```

## Configuration

`testero.config.ts` (or `.js`) in the current directory overrides the
defaults, using Jest's names: objects are merged deeply, anything else,
like `ignore`, is replaced.

```js
export default {
    ignore: [".git", "node_modules"],
    rules: { clearMocks: true, testMatch: ["**/tests/**/*.test.ts"] },
};
```

| Option                | Default                           | Description                                                                                       |
| --------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------- |
| `bail`                | `false`                           | Stops after the first failing test file.                                                          |
| `clearMocks`          | `false`                           | Clears the calls of every mock before each test.                                                  |
| `collectCoverage`     | `false`                           | Reports coverage, like `--coverage`.                                                              |
| `collectCoverageFrom` | `[]`                              | Globs of the sources coverage is reported for, "!" excludes; empty takes the ones the tests load. |
| `coverageDirectory`   | `"coverage"`                      | Where `lcov.info` goes.                                                                           |
| `passWithNoTests`     | `false`                           | Succeeds when there are no test files.                                                            |
| `resetMocks`          | `false`                           | Also removes mock implementations.                                                                |
| `restoreMocks`        | `false`                           | Also restores the original functions of spies.                                                    |
| `testMatch`           | `__tests__` and `*.{spec,test}.*` | Globs of test files, the last match decides.                                                      |
| `testTimeout`         | `5000`                            | Milliseconds a test or hook may take.                                                             |
| `verbose`             | `false`                           | Lists every test, not only the failing ones.                                                      |

## How it works

```
test file
├─> src/transformer.ts   bundles it with esbuild, injecting the globals
├─> src/collector.ts     collects its suites and tests into a tree
├─> src/runner.ts        runs them, with hooks, timeouts and done callbacks
├─> src/reporter.ts      prints the results like Jest does
└─> src/coverage.ts      maps V8's counts back to the sources, with --coverage
```

| Module               | Description                                                     |
| -------------------- | --------------------------------------------------------------- |
| `@aljazmc/config`    | Loads `testero.config.ts`, finds files and matches `testMatch`. |
| `src/collector.ts`   | Collects `describe`, `test` and hooks into a suite tree.        |
| `src/coverage.ts`    | V8 coverage of the bundles, by their source maps, and lcov.     |
| `src/expect`         | `expect`, matchers, deep equality and value diffs.              |
| `src/mock.ts`        | Mock functions and spies.                                       |
| `src/reporter.ts`    | Prints results like Jest's default reporter.                    |
| `src/runner.ts`      | Runs tests with focus, skips, hooks and timeouts.               |
| `src/testero.ts`     | Finds test files and runs them one after another.               |
| `src/transformer.ts` | Bundles test files with esbuild, packages stay external.        |
| `src/watcher.ts`     | Reruns tests on changes, finding the ones a change concerns.    |

Test files run sequentially in one process. There are no workers, module
mocks, fake timers or snapshots. Coverage counts lines and functions, not
statements or branches; functions inside one that never ran are not
counted, as V8 does not know them yet.

## Tests

```sh
docker compose run --rm node yarn t:testero       # all 59 tests
docker compose run --rm node yarn tunit:testero   # 47 unit tests
docker compose run --rm node yarn te2e:testero    # 12 end-to-end tests
```

testero tests itself: the build in `bin/` runs the tests of the sources
in `src/`.

- **Unit tests** cover value formatting and diffs, deep equality, the
  matchers, mocks, `.each`, the runner with its hooks, focus and
  timeouts, the arguments, coverage and the watcher.
- **End-to-end tests** run testero on test files written to a temporary
  folder: compiling TypeScript, failure output with code frames,
  `import.meta` and `__dirname`, imported globals, patterns, coverage
  with `lcov.info`, and the inputs watch mode follows.

The same runner runs all 2,141 tests of this repository, see the
[root README](../../README.md#development).

## License

MIT, see [LICENSE](LICENSE).
