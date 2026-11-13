![Custom](https://img.shields.io/badge/project_status-mostly_working-green) ![Custom](https://img.shields.io/badge/breaking_changes-common-red) ![NPM Downloads](https://img.shields.io/npm/dm/%40aljazmc%2Fmonorepo) ![GitHub package.json version](https://img.shields.io/github/package-json/v/aljazmc/aljazmc?filename=packages%2Fmonorepo%2Fpackage.json&color=green) ![GitHub License](https://img.shields.io/github/license/aljazmc/aljazmc)

# > monorepo

A simple, dependency-free monorepo release tool. It versions each package
on its own by [conventional commits](https://www.conventionalcommits.org),
and moves the tags a rebase left behind. Easy to understand, easy to
customize and easy to extend.

## > Features

| Feature              | Description                                                             |
| -------------------- | ----------------------------------------------------------------------- |
| Dependency awareness | Changes to `workspace:` dependencies bump the packages that use them.   |
| Dry runs             | `--dry-run` prints every write, commit, tag and push, changing nothing. |
| Independent versions | Each package is bumped, committed and tagged on its own.                |
| Rebase recovery      | Finds the rebased commits of tags left behind, locally and on remote.   |
| Safe pushes          | Branch and tags are pushed atomically, all or nothing.                  |

## > Install

```sh
npm install --save-dev @aljazmc/monorepo
```

Requires git and Node.js 22.18+, 24.2+, 25 or 26.

## > Usage

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

## > Versions

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

## > Tags

A rebased commit is matched by author, author date and subject, or by
`git patch-id --stable` when reworded. Ambiguous matches and dropped
commits are reported as unresolved and left alone. Annotated tags keep
their message, tagger and date, signed tags lose their signature.

## > Configuration

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

## > How it works

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

## > License

MIT, see [LICENSE](LICENSE).
