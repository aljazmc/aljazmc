![NPM Downloads by package author](https://img.shields.io/npm-stat/dy/aljazmc)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/aljazmc/aljazmc/.github%2Fworkflows%2Fcicd.yml)
![GitHub Issues or Pull Requests](https://img.shields.io/github/issues/aljazmc/aljazmc)
![GitHub License](https://img.shields.io/github/license/aljazmc/aljazmc)\
![GitHub commit activity](https://img.shields.io/github/commit-activity/y/aljazmc/aljazmc)
![GitHub code size in bytes](https://img.shields.io/github/languages/code-size/aljazmc/aljazmc)

# > aljazmc

Lightweight npm packages written in modern TypeScript: a formatter, a
linter, a monorepo release tool and a test runner. They depend on nothing
outside this repository, except esbuild for testero, and are published by
[aljazmc on npm](https://www.npmjs.com/~aljazmc).

## > Packages

| Package                         | Description                                                        | npm                                                                    |
| ------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| [formatero](packages/formatero) | Formats CSS, HTML, JavaScript, JSON, JSX, Markdown and TypeScript. | [@aljazmc/formatero](https://www.npmjs.com/package/@aljazmc/formatero) |
| [lintero](packages/lintero)     | Lints the same languages with 287 rules and automatic fixes.       | [@aljazmc/lintero](https://www.npmjs.com/package/@aljazmc/lintero)     |
| [monorepo](packages/monorepo)   | Versions packages by conventional commits, fixes rebased tags.     | [@aljazmc/monorepo](https://www.npmjs.com/package/@aljazmc/monorepo)   |
| [testero](packages/testero)     | Runs Jest-like tests in JavaScript, JSX and TypeScript.            | [@aljazmc/testero](https://www.npmjs.com/package/@aljazmc/testero)     |

## > Shared code

Bundled into the packages by esbuild, and published for their types.

| Package                          | Description                                                       |
| -------------------------------- | ----------------------------------------------------------------- |
| [@aljazmc/config](shared/config) | Loads `<package>.config.ts` files, finds files and matches globs. |
| [@aljazmc/syntax](shared/syntax) | Parses CSS, HTML, JavaScript, JSON, JSX, Markdown and TypeScript. |

## > Development

Requires only Docker with Compose, everything else runs in a container.

| Command                                                         | Description                                              |
| --------------------------------------------------------------- | -------------------------------------------------------- |
| `./project.sh clean`                                            | Removes the container, dependencies and generated files. |
| `./project.sh start`                                            | Installs dependencies, then lints, tests and builds all. |
| `docker compose run --rm node yarn <script>`                    | Runs any script of `package.json`.                       |
| `docker compose run --rm node node packages/<name>/bin/main.js` | Runs a package on this repository.                       |

### > Scripts

Scripts are named `<prefix>:<package>`, like `c:lintero`, and most
prefixes also have `<prefix>:all`.

| Prefix   | Description                                 |
| -------- | ------------------------------------------- |
| `b:`     | Builds the package with esbuild.            |
| `c:`     | Lints, tests, builds and exports the types. |
| `ct:`    | Checks the types.                           |
| `et:`    | Exports the types as declaration files.     |
| `l:`     | Lints.                                      |
| `lw:`    | Lints and writes the safe fixes.            |
| `lwu:`   | Lints and writes the unsafe fixes too.      |
| `p:`     | Publishes to npm.                           |
| `t:`     | Runs the tests.                             |
| `te2e:`  | Runs the end-to-end tests.                  |
| `tunit:` | Runs the unit tests.                        |

### > CI/CD

```
push to main
├─> yarn c:<package>   checks each changed package
├─> monorepo --push    bumps, commits, tags and pushes the versions
└─> yarn p:all         publishes the versions not yet on npm, dependencies first
```

### > Layout

| Path                  | Description                                                |
| --------------------- | ---------------------------------------------------------- |
| `<package>.config.ts` | How the packages check this repository.                    |
| `packages/<name>/`    | Published packages, each with `src/`, `tests/` and README. |
| `project.sh`          | Creates the container and runs the checks.                 |
| `shared/<name>/`      | Code bundled into the packages.                            |

## > License

MIT, see [LICENSE](LICENSE).
