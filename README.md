# aljazmc

[![CI](https://github.com/aljazmc/aljazmc/actions/workflows/ci.yml/badge.svg)](https://github.com/aljazmc/aljazmc/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm downloads](https://img.shields.io/npm-stat/dy/aljazmc?logo=npm&color=cb3837&label=npm%20downloads)](https://www.npmjs.com/~aljazmc)
[![TypeScript 7](https://img.shields.io/badge/TypeScript-7%20strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![esbuild](https://img.shields.io/badge/esbuild-0.28-ffcf00?logo=esbuild&logoColor=black)](https://esbuild.github.io/)
[![Yarn 4](https://img.shields.io/badge/Yarn-4-2c8ebb?logo=yarn&logoColor=white)](https://yarnpkg.com/)
[![Docker only](https://img.shields.io/badge/development-Docker%20only-2496ed?logo=docker&logoColor=white)](#development)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-fe5196?logo=conventionalcommits&logoColor=white)](https://www.conventionalcommits.org/)

Lightweight npm packages written in modern TypeScript: a formatter, a
linter, a monorepo release tool and a test runner. They depend on nothing
outside this repository, except esbuild for testero, and are published by
[aljazmc on npm](https://www.npmjs.com/~aljazmc).

<p align="center">
  <img src=".github/assets/terminal.svg" alt="lintero reports unsorted imports and a debugger statement, fixes them with --write --unsafe, then formatero formats the module and both find nothing left">
</p>

## Features

- **Four tools, no dependencies.** A formatter, a linter, a test runner and
  a release tool that depend on nothing outside this repository, except
  esbuild for testero.
- **Eight languages.** formatero formats CSS, HTML, JavaScript, JSON, JSX,
  Markdown, TypeScript and YAML; lintero lints all of them but YAML with
  287 rules, fixes and sorted imports.
- **One parser.** Every tool shares `@aljazmc/syntax`, bundled in by
  esbuild.
- **Checked by itself.** formatero formats this repository, lintero lints
  it and testero runs its tests.
- **Released by CI.** After every passing push to `main`, CI versions,
  publishes, tags and releases on GitHub each package that changed, from
  its conventional commits, without committing anything.

## Quick start

```sh
npm install --save-dev @aljazmc/formatero @aljazmc/lintero
npx formatero            # lists unformatted files
npx formatero --write    # formats them in place
```

The packages need Node.js 22.18+, 24.2+, 25 or 26; each package's README
lists its commands and options.

To work on the packages, clone the repository and let Docker do the rest:

```sh
git clone https://github.com/aljazmc/aljazmc.git
cd aljazmc
./project.sh start
```

## Packages

| Package                         | Description                                                                 | Version                                      |
| ------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------- |
| [formatero](packages/formatero) | Formats CSS, HTML, JavaScript, JSON, JSX, Markdown, TypeScript and YAML.    | [![version][formatero-badge]][formatero-npm] |
| [lintero](packages/lintero)     | Lints the same languages but YAML with 287 rules, fixes and sorted imports. | [![version][lintero-badge]][lintero-npm]     |
| [monorepo](packages/monorepo)   | Versions packages by conventional commits, fixes rebased tags.              | [![version][monorepo-badge]][monorepo-npm]   |
| [testero](packages/testero)     | Runs Jest-like tests in JavaScript, JSX and TypeScript.                     | [![version][testero-badge]][testero-npm]     |

[formatero-badge]: https://img.shields.io/npm/v/@aljazmc/formatero?label=&color=cb3837
[formatero-npm]: https://www.npmjs.com/package/@aljazmc/formatero
[lintero-badge]: https://img.shields.io/npm/v/@aljazmc/lintero?label=&color=cb3837
[lintero-npm]: https://www.npmjs.com/package/@aljazmc/lintero
[monorepo-badge]: https://img.shields.io/npm/v/@aljazmc/monorepo?label=&color=cb3837
[monorepo-npm]: https://www.npmjs.com/package/@aljazmc/monorepo
[testero-badge]: https://img.shields.io/npm/v/@aljazmc/testero?label=&color=cb3837
[testero-npm]: https://www.npmjs.com/package/@aljazmc/testero

## Comparison

How formatero, lintero and testero compare with Prettier, ESLint, Biome,
Jest and Vitest on the code of this repository. `yarn bench` installs the
other tools, pinned, into `.cache/` only, without running their install
scripts, and runs every tool on a temporary copy of the sources.

<!-- benchmark:start -->

Measured on 2026-11-28 with `yarn bench`, on the 421 TypeScript files of the
packages' `src` folders, 60,468 lines, and the 4 test files of `shared/`, in
Docker on 8 cores of an Intel(R) Core(TM) i7-8550U CPU @ 1.80GHz, with Node.js
v26.13.1. A time is the median of 5 runs after one to warm up. Packages and
Installed are what `npm install` of a tool brings in; Biome is a native binary,
the others run on Node.js.

**Formatting**, checking every file with the same settings: Prettier 3.10.1 and
Biome 2.6.6. Changes are the files a write would change; formatero formats this
repository.

| Tool          | Time   | Relative | Changes  | Packages | Installed |
| ------------- | ------ | -------- | -------- | -------- | --------- |
| **formatero** | 1.62 s | 1.0×     | 0 files  | 3        | 1.4 MB    |
| Prettier      | 5.46 s | 3.4×     | 16 files | 1        | 11.1 MB   |
| Biome         | 210 ms | 0.1×     | 0 files  | 2        | 93.6 MB   |

**Linting** with each tool's recommended rules: ESLint 10.16.0 with
typescript-eslint 8.74.0, and Biome 2.6.6. The rules differ, and so do the
problems they find.

| Tool        | Time   | Relative | Problems    | Packages | Installed |
| ----------- | ------ | -------- | ----------- | -------- | --------- |
| **lintero** | 1.91 s | 1.0×     | 0 problems  | 3        | 3.1 MB    |
| ESLint      | 5.44 s | 2.8×     | 24 problems | 97       | 46.9 MB   |
| Biome       | 323 ms | 0.2×     | 0 problems  | 2        | 93.6 MB   |

**Testing**, the same tests unchanged: Jest 30.5.2, with esbuild for TypeScript,
and Vitest 5.1.2.

| Tool        | Time   | Relative | Passed   | Packages | Installed |
| ----------- | ------ | -------- | -------- | -------- | --------- |
| **testero** | 687 ms | 1.0×     | 59 tests | 4        | 11.4 MB   |
| Jest        | 1.39 s | 2.0×     | 59 tests | 280      | 64.7 MB   |
| Vitest      | 1.23 s | 1.8×     | 59 tests | 35       | 41.5 MB   |

<!-- benchmark:end -->

## Shared code

Bundled into the packages by esbuild, and published for their types.

| Package                          | Description                                                             |
| -------------------------------- | ----------------------------------------------------------------------- |
| [@aljazmc/config](shared/config) | Loads `<package>.config.ts` files, finds files and matches globs.       |
| [@aljazmc/syntax](shared/syntax) | Parses CSS, HTML, JavaScript, JSON, JSX, Markdown, TypeScript and YAML. |

## Development

Requires only Docker with Compose, everything else runs in a container.

The repository checks itself with its own packages: formatero formats it,
lintero lints it and organizes its imports, and testero runs its tests.
Scripts build the package they run first, so they also work in a fresh
clone.

| Command                                                         | Description                                              |
| --------------------------------------------------------------- | -------------------------------------------------------- |
| `./project.sh clean`                                            | Removes the container, dependencies and generated files. |
| `./project.sh start`                                            | Installs dependencies, then lints, tests and builds all. |
| `docker compose run --rm node yarn <script>`                    | Runs any script of `package.json`.                       |
| `docker compose run --rm node node packages/<name>/bin/main.js` | Runs a package on this repository.                       |

### Scripts

Scripts are named `<prefix>:<package>`, like `c:lintero`, and most
prefixes also have `<prefix>:all`.

| Prefix   | Description                                 |
| -------- | ------------------------------------------- |
| `b:`     | Builds the package with esbuild.            |
| `c:`     | Lints, tests, builds and exports the types. |
| `ct:`    | Checks the types.                           |
| `et:`    | Exports the types as declaration files.     |
| `l:`     | Checks the formatting and lints.            |
| `lw:`    | Writes the safe fixes and the formatting.   |
| `lwu:`   | Writes the unsafe fixes too.                |
| `p:`     | Publishes to npm.                           |
| `t:`     | Runs the tests.                             |
| `te2e:`  | Runs the end-to-end tests.                  |
| `tunit:` | Runs the unit tests.                        |

| Script             | Description                                            |
| ------------------ | ------------------------------------------------------ |
| `bench`            | Compares the tools with others, `--readme` writes it.  |
| `record:formatero` | Records what Biome 2.6.6 prints for formatero's cases. |
| `record:lintero`   | Records what Biome 2.6.6 reports for lintero's cases.  |
| `c:github`         | Lints and tests the scripts of CI and the picture.     |
| `t:coverage`       | Runs all tests and reports the coverage.               |
| `test:w`           | Runs all tests again whenever a file changes.          |
| `typecheck:w`      | Checks the types again whenever a file changes.        |

### CI/CD

```
push to main, ci.yml
├─> yarn c:<package>   checks each changed package, and the release script
├─> coverage           all tests, with the coverage in the job summary
├─> quickstart         the quick start above, with the packages from npm
└─> fixes              each fix has a test that fails without it

a passing ci.yml on main, release.yml
├─> release.ts plan    the versions due, from conventional commits since each tag
├─> yarn c:<package>   checks each with its version written in
├─> npm publish        publishes it with provenance, a dependency first
├─> git tag            tags it @aljazmc/<name>@<version> and pushes the tag
└─> gh release         a GitHub release with notes from its commits
```

Versions live in the tags only: `package.json` keeps `0.0.0-development`,
and no version is ever committed. `feat` releases a minor version; `fix`,
`perf`, `docs`, `chore` and `revert` a patch; a breaking change a major one,
before 1.0.0 a minor one; `style`, `test`, `build` and `ci` nothing. A
commit counts for each package whose folder, or bundled `shared/` code, it
changes. Every Monday CI checks everything again and opens an issue when
that fails.

Publishing needs no token: npm trusts `release.yml` of this repository, and
every version carries a provenance statement that links it to the run and
the commit it was built from.

Every `fix` since 28 November 2026 comes with a test that fails without it:
CI undoes the rest of the commit, keeps its tests and expects them to fail,
see `.github/scripts/fixes.ts`.

### Layout

| Path                  | Description                                                |
| --------------------- | ---------------------------------------------------------- |
| `<package>.config.ts` | How the packages check this repository.                    |
| `.github/scripts/`    | The release script, and the one that draws the picture.    |
| `packages/<name>/`    | Published packages, each with `src/`, `tests/` and README. |
| `project.sh`          | Creates the container and runs the checks.                 |
| `shared/<name>/`      | Code bundled into the packages.                            |

## Troubleshooting

| What you see                                                                  | Why                                                                                                                                                | What to do                                                                                                |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `npx formatero` or `npx lintero` prints nothing and exits with 0              | Node.js is older than the packages need, like 22.12; npm warned `EBADENGINE` when installing them                                                  | Check `node -v`, then update to Node.js 22.18+, 24.2+, 25 or 26                                           |
| `npx formatero` prints `Hello, formatter!`, or `npx lintero` `Hello, linter!` | On a Node.js the packages do not list, like 27, npm installs the newest version that allows it, a deprecated placeholder of spring 2026, and warns | Use Node.js 22.18+, 24.2+, 25 or 26, or install `@aljazmc/formatero@latest` and `@aljazmc/lintero@latest` |
| `unformatted: <file>` and exit code 1                                         | The file is not formatted yet; that is what checking reports                                                                                       | `npx formatero --write`, or the same in a pre-commit hook                                                 |
| `error: <file>:<line>:<column> ...` and the file is left as it is             | The file does not parse; like Biome, formatero formats no file with errors, and lintero reports them as `parse`                                    | Fix the error at that place, or set `formatWithErrors: true` in `formatero.config.ts`                     |
| Working on the packages, the container runs an old image after `git pull`     | `docker-compose.yml` is generated once by `./project.sh start` and kept, so a newer `project.sh` with another image does not reach it              | `./project.sh clean`, then `./project.sh start`                                                           |

## Feedback

Questions, bugs and ideas are welcome as
[issues](https://github.com/aljazmc/aljazmc/issues); pull requests too,
see [CONTRIBUTING.md](CONTRIBUTING.md).

## Other projects

| Repository                                                                    | What it is                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [threejs-landscapes](https://github.com/aljazmc/threejs-landscapes)           | Three first person shooters and a neon map of Ptuj in three.js, playable in the browser: [Bloodmoon Manor](https://aljazmc.github.io/bloodmoon-preview/), [Hull Breach](https://aljazmc.github.io/hullbreach-preview/), [Moonshadow Keep](https://aljazmc.github.io/moonshadow-preview/) and [Ptuj](https://aljazmc.github.io/ptuj-preview/). |
| [dockerfiles](https://github.com/aljazmc/dockerfiles)                         | Docker images for Node.js, Blender, Inkscape, Wine and more, the one this repository develops in.                                                                                                                                                                                                                                             |
| [docker-dev-scripts](https://github.com/aljazmc/docker-dev-scripts)           | One-command Docker development environments for 19 stacks and 3 network monitoring labs.                                                                                                                                                                                                                                                      |
| [dlib-si-scripts](https://github.com/aljazmc/dlib-si-scripts)                 | Download scripts for the Digital Library of Slovenia, dlib.si.                                                                                                                                                                                                                                                                                |
| [gog-linux-docker-script](https://github.com/aljazmc/gog-linux-docker-script) | Runs GOG games in a Docker container.                                                                                                                                                                                                                                                                                                         |
| [yt-dlp-docker-script](https://github.com/aljazmc/yt-dlp-docker-script)       | Runs yt-dlp in a Docker container.                                                                                                                                                                                                                                                                                                            |

All 17 are on [the profile](https://github.com/aljazmc?tab=repositories).

## License

MIT, see [LICENSE](LICENSE).
