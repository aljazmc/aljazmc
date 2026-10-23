![NPM Downloads by package author](https://img.shields.io/npm-stat/dy/aljazmc)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/aljazmc/aljazmc/.github%2Fworkflows%2Fcicd.yml)
![GitHub Issues or Pull Requests](https://img.shields.io/github/issues/aljazmc/aljazmc)
![GitHub License](https://img.shields.io/github/license/aljazmc/aljazmc)\
![GitHub commit activity](https://img.shields.io/github/commit-activity/y/aljazmc/aljazmc)
![GitHub code size in bytes](https://img.shields.io/github/languages/code-size/aljazmc/aljazmc)

# > aljazmc's NPMJS Packages Monorepo

Lightweight NPM packages, written in modern TypeScript.

## > Package List

- [@aljazmc/formatero](packages/formatero) - a [Biome](https://biomejs.dev)-like formatter for JavaScript, TypeScript, JSX and JSON
- [@aljazmc/lintero](packages/lintero) - a Biome-like linter, with 153 lint rules and Biome-like settings and suppressions
- [@aljazmc/monorepo](packages/monorepo) - a monorepo management tool that moves tags to the commits a rebase made, locally and on the remote
- [@aljazmc/testero](packages/testero) - a Jest-like test runner, compiling tests with [esbuild](https://esbuild.github.io)

Shared code is bundled into the packages that use it, so they have no dependencies of their own, except esbuild for testero:
- [@aljazmc/config](shared/config) - loads `<package>.config.ts` files, finds files and matches globs
- [@aljazmc/syntax](shared/syntax) - parses JavaScript, TypeScript, JSX and JSON into syntax trees

## > Development Info

Everything runs in a Node.js container, with Docker:

```sh
./project.sh start  # create docker-compose.yml, install dependencies, then lint, test, build and export types of everything
./project.sh clean  # remove the container, dependencies and generated files
docker compose run --rm node yarn c:testero  # or any other script
```

The packages check this repository too, configured by `formatero.config.ts`, `lintero.config.ts` (both from `biome.json`) and `testero.config.ts`:

```sh
docker compose run --rm node node packages/formatero/bin/main.js
docker compose run --rm node node packages/lintero/bin/main.js
docker compose run --rm node node packages/testero/bin/main.js
docker compose run --rm node node packages/monorepo/bin/main.js tags
```

###### package.json's "scripts" field naming conventions:

- b: - build
- c: - complete
- ct: - check types
- et: - export types
- l: - lint
- lw: - lint && write
- lwu: - lint && write unsafe
- p: - publish
- t: - test
- te2e: - test end-to-end
- tunit: - test unit
