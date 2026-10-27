![NPM Downloads by package author](https://img.shields.io/npm-stat/dy/aljazmc)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/aljazmc/aljazmc/.github%2Fworkflows%2Fcicd.yml)
![GitHub Issues or Pull Requests](https://img.shields.io/github/issues/aljazmc/aljazmc)
![GitHub License](https://img.shields.io/github/license/aljazmc/aljazmc)\
![GitHub commit activity](https://img.shields.io/github/commit-activity/y/aljazmc/aljazmc)
![GitHub code size in bytes](https://img.shields.io/github/languages/code-size/aljazmc/aljazmc)

# aljazmc

Lightweight npm packages, written in modern TypeScript: a formatter, a
linter, a test runner and a monorepo tool. No package depends on
anything outside of this repository, except esbuild for testero, and all
of them are published by [aljazmc on npm](https://www.npmjs.com/~aljazmc).

## Packages

| Package                         | What it does                                                                                       | npm                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [formatero](packages/formatero) | Formats JavaScript, TypeScript, JSX, JSON and Markdown, with options compatible with Biome's.      | [@aljazmc/formatero](https://www.npmjs.com/package/@aljazmc/formatero) |
| [lintero](packages/lintero)     | Lints JavaScript, TypeScript, JSX, JSON and Markdown with 232 rules compatible with Biome's.       | [@aljazmc/lintero](https://www.npmjs.com/package/@aljazmc/lintero)     |
| [monorepo](packages/monorepo)   | Versions each package on its own by conventional commits, and moves the tags a rebase left behind. | [@aljazmc/monorepo](https://www.npmjs.com/package/@aljazmc/monorepo)   |
| [testero](packages/testero)     | Runs Jest-like tests in JavaScript, TypeScript and JSX, compiled with esbuild.                     | [@aljazmc/testero](https://www.npmjs.com/package/@aljazmc/testero)     |

The packages share code, published for its types and bundled by esbuild
into the packages that use it:

| Shared code                      | What it does                                                      |
| -------------------------------- | ----------------------------------------------------------------- |
| [@aljazmc/config](shared/config) | Loads `<package>.config.ts` files, finds files and matches globs. |
| [@aljazmc/syntax](shared/syntax) | Parses JavaScript, TypeScript, JSX, JSON and Markdown into trees. |

## Requirements

- Docker with Compose. Everything else, Node.js and yarn included, runs in a container.

## Usage

```sh
./project.sh start  # create docker-compose.yml, install the dependencies, then lint, test, build and export the types of everything
./project.sh clean  # remove the container, the dependencies and the generated files
docker compose run --rm node yarn c:testero  # run any script of package.json
```

The packages check this repository too, configured by
`formatero.config.ts`, `lintero.config.ts`, `monorepo.config.ts` and
`testero.config.ts`:

```sh
docker compose run --rm node node packages/formatero/bin/main.js
docker compose run --rm node node packages/lintero/bin/main.js
docker compose run --rm node node packages/testero/bin/main.js
docker compose run --rm node node packages/monorepo/bin/main.js tags
```

### Scripts

The scripts of `package.json` are named `<prefix>:<package>`, like
`c:lintero`, and most prefixes also have `<prefix>:all`:

| Prefix   | What it does                                                      |
| -------- | ----------------------------------------------------------------- |
| `b:`     | builds the package with esbuild                                   |
| `c:`     | completes every check: lints, tests, builds and exports the types |
| `ct:`    | checks the types                                                  |
| `et:`    | exports the types, as declaration files                           |
| `l:`     | lints with Biome                                                  |
| `lw:`    | lints and writes the safe fixes                                   |
| `lwu:`   | lints and writes the unsafe fixes too                             |
| `p:`     | publishes to npm                                                  |
| `t:`     | runs the tests                                                    |
| `te2e:`  | runs the end-to-end tests                                         |
| `tunit:` | runs the unit tests                                               |

## Monorepo structure

```
push to main
├─> yarn c:<package>    lints, tests, builds and exports the types of each changed package
├─> monorepo --push     bumps, commits, tags and pushes the versions, by conventional commits
└─> yarn p:all          publishes the versions that are not on npm yet, dependencies first
```

```
packages/<name>/       the published packages, each with its src/, tests/ and README
shared/<name>/         code bundled into the packages, published for their types
<package>.config.ts    how the packages check this repository
project.sh             creates the container and runs the checks
```

## License

MIT, see [LICENSE](LICENSE).
