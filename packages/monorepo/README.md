# monorepo

[![CI](https://github.com/aljazmc/aljazmc/actions/workflows/ci.yml/badge.svg)](https://github.com/aljazmc/aljazmc/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@aljazmc/monorepo?logo=npm&color=cb3837)](https://www.npmjs.com/package/@aljazmc/monorepo)
[![npm downloads](https://img.shields.io/npm/dm/@aljazmc/monorepo?logo=npm&color=cb3837&label=downloads)](https://www.npmjs.com/package/@aljazmc/monorepo)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/node/v/@aljazmc/monorepo?logo=nodedotjs&logoColor=white&color=5fa04e)](https://nodejs.org/)
[![Third-party dependencies: none](https://img.shields.io/badge/third--party%20dependencies-none-brightgreen)](package.json)
[![Git](https://img.shields.io/badge/needs-git-f05032?logo=git&logoColor=white)](https://git-scm.com/)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-fe5196?logo=conventionalcommits&logoColor=white)](https://www.conventionalcommits.org/)
[![Tests](https://img.shields.io/badge/tests-32%20passing-brightgreen)](#tests)

A dependency-free release tool for monorepos. It versions each package on
its own from its [conventional commits](https://www.conventionalcommits.org),
commits and tags the new versions, and moves the tags a rebase left on
commits that no longer exist.

```sh
npx @aljazmc/monorepo version --write --push
```

## Features

- **Independent versions.** Each package is bumped, committed and tagged
  on its own, from the commits that touched its folder.
- **Dependency aware.** A change to a `workspace:` dependency bumps the
  packages that use it.
- **Rebase recovery.** Finds where rebased commits went, by author, date
  and subject or by patch id, and moves their tags there, locally and on
  the remote.
- **Safe pushes.** The branch and its tags are pushed atomically, all or
  nothing.
- **Dry runs.** `--dry-run` prints every write, commit, tag and push,
  changing nothing.
- **Built for CI.** One command, `monorepo --push`, after the checks pass.
  This repository releases itself with it.

## Quick start

```sh
npm install --save-dev @aljazmc/monorepo
npx monorepo --config      # writes the defaults to monorepo.config.ts
npx monorepo               # shows what tags and version would do
npx monorepo --push        # moves tags, bumps, commits, tags and pushes
```

Requires git and Node.js 22.18+, 24.2+, 25 or 26.

## Usage

| Command                             | Description                                                   |
| ----------------------------------- | ------------------------------------------------------------- |
| `monorepo`                          | Runs `tags`, then `version`, showing what both would do.      |
| `monorepo --config [js]`            | Writes the defaults to `monorepo.config.ts` (`.js`).          |
| `monorepo --push`                   | Moves left-behind tags, then bumps, commits, tags and pushes. |
| `monorepo tags`                     | Lists tags left on replaced commits, exits with 1 if any.     |
| `monorepo tags --write [--push]`    | Moves the local tags, and force pushes them with `--push`.    |
| `monorepo version`                  | Lists the versions the changed packages need.                 |
| `monorepo version --write [--push]` | Bumps, commits and tags them, and pushes them with `--push`.  |

Every command accepts `--dry-run`, `--remote <name>` and `--branch <name>`.

```text
released: @aljazmc/lintero 0.2.0 -> 0.3.0 (minor, @aljazmc/lintero@0.3.0)
mangled: v0.1.5 875b883 -> 1c9d2e4 (local, origin)
```

### In CI

This repository runs it on every push to `main`, after the checks:

```
push to main
├─> yarn c:<package>   checks each changed package
├─> monorepo --push    bumps, commits, tags and pushes the versions
└─> yarn p:all         publishes the versions not yet on npm
```

## Versions

Commits since a package's last tag count when they change its folder or
a `workspace:` dependency. Packages are tagged `name@version`, the root
`package.json` as `v<version>`. An untagged version counts commits since
it was last changed, and is bumped or tagged as it is.

| Commit type                                     | Bump                      |
| ----------------------------------------------- | ------------------------- |
| any other, like `style` or `test`               | none                      |
| breaking: `feat!:` or `BREAKING CHANGE:` footer | major, minor before 1.0.0 |
| `chore`, `docs`, `fix`, `perf`, `revert`        | patch                     |
| `feat`                                          | minor                     |

## Tags

A rebased commit is matched by author, author date and subject, or by
`git patch-id --stable` when reworded. Ambiguous matches and dropped
commits are reported as unresolved and left alone. Annotated tags keep
their message, tagger and date, signed tags lose their signature.

## Configuration

`monorepo.config.ts` (or `.js`) in the current directory overrides the
defaults: objects are merged deeply, anything else, like `ignore`, is
replaced.

```js
export default {
    ignore: [".git", "node_modules"],
    rules: {
        packages: ["packages/*"],
        bump: { chore: false, test: "patch" },
    },
};
```

| Option     | Default                                  | Description                                              |
| ---------- | ---------------------------------------- | -------------------------------------------------------- |
| `branch`   | `"HEAD"`                                 | Branch tags must be in, and versions are pushed to.      |
| `bump`     | `feat: "minor"`, others `"patch"`        | Commit types that bump a version, `false` turns one off. |
| `message`  | `"version: update {name} to v{version}"` | Commit message of a version.                             |
| `packages` | `[".", "packages/*"]`                    | Folders of independently versioned packages.             |
| `remote`   | `"origin"`                               | Remote that tags and versions are pushed to.             |
| `rootTag`  | `"v{version}"`                           | Tag of the root `package.json` version.                  |
| `tag`      | `"{name}@{version}"`                     | Tag of a package version.                                |

## How it works

```
git history
├─> src/tags.ts       finds tags left on rebased commits and moves them
└─> src/versions.ts   bumps, commits and tags the changed packages
```

| Module            | Description                                                   |
| ----------------- | ------------------------------------------------------------- |
| `@aljazmc/config` | Loads `monorepo.config.ts`.                                   |
| `src/git.ts`      | Runs git, lists local and remote tags with annotations.       |
| `src/history.ts`  | Finds rebased commits by author, date, subject or patch id.   |
| `src/monorepo.ts` | Runs the commands on a repository.                            |
| `src/tags.ts`     | Plans where each tag belongs, moves and pushes it.            |
| `src/versions.ts` | Finds changed packages, then bumps, commits, tags and pushes. |

## Tests

```sh
docker compose run --rm node yarn t:monorepo
```

32 tests, run by [testero](../testero). They create real git
repositories, each with a bare `origin`, in temporary folders, so they
need git but never touch the repository they run in:

| Suite              | Checks                                                             |
| ------------------ | ------------------------------------------------------------------ |
| `bump`             | The bump of each commit type, breaking changes before 1.0.0 too.   |
| `monorepo tags`    | Finding rebased commits and moving their tags, locally and remote. |
| `monorepo version` | Changed packages and dependents, their commits, tags and pushes.   |
| `setVersion`       | Writing a version into `package.json`, keeping its formatting.     |
| `arguments`        | Commands and options, and the errors for wrong ones.               |

## License

MIT, see [LICENSE](LICENSE).
