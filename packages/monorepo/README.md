![Custom](https://img.shields.io/badge/project_status-mostly_working-green) ![Custom](https://img.shields.io/badge/breaking_changes-common-red) ![NPM Downloads](https://img.shields.io/npm/dm/%40aljazmc%2Fmonorepo) ![GitHub package.json version](https://img.shields.io/github/package-json/v/aljazmc/aljazmc?filename=packages%2Fmonorepo%2Fpackage.json&color=green) ![GitHub License](https://img.shields.io/github/license/aljazmc/aljazmc)

# monorepo

A simple monorepo management tool. It versions each package on its own,
by [conventional commits](https://www.conventionalcommits.org), and moves
the tags a rebase left behind. Easy to understand, easy to customize and
easy to extend.

## Install

```sh
npm install --save-dev @aljazmc/monorepo
```

monorepo needs Node.js 22.18 or later, or 24.2 or later, and git.

## Usage

```sh
monorepo                           # tags, then version: show what both would do
monorepo --push                    # move the tags a rebase left behind, then bump, commit, tag and push the versions
monorepo --push --dry-run          # print what it would write, move, commit, tag and push, changing nothing
monorepo version                   # list the versions the changed packages need
monorepo version --write           # bump, commit and tag them
monorepo version --push            # also push the branch and the tags to origin
monorepo version --push --dry-run  # print what it would write, commit, tag and push, changing nothing
monorepo tags                      # list the tags left on commits a rebase replaced, exit 1 if there are any
monorepo tags --write              # move the local tags to the rebased commits
monorepo tags --write --push       # also force push the moved tags to origin
monorepo --config                  # write the defaults to monorepo.config.ts, --config js to monorepo.config.js
```

Without a command, monorepo runs `tags` and then `version`, with the
same options. That is the usual workflow: versions count the commits
since the tag of each package, so tags left behind by a rebase are moved
first.

`--dry-run` prints what `--write` and `--push` would do, without
changing files, making commits, tagging or pushing. On its own, it shows
what `--write` would do:

```text
would release: @aljazmc/lintero 0.2.0 -> 0.3.0 (minor, @aljazmc/lintero@0.3.0)
would write: packages/lintero/package.json ("version": "0.3.0")
would run: git add -- packages/lintero/package.json
would run: git commit -q -m 'version: update @aljazmc/lintero to v0.3.0' -- packages/lintero/package.json
would run: git tag -a @aljazmc/lintero@0.3.0 -m 'version: update @aljazmc/lintero to v0.3.0'
would run: git push -q --atomic origin HEAD refs/tags/@aljazmc/lintero@0.3.0
```

## Versions

`monorepo version` looks at the commits since the last version of each
package. Those that change its folder count, and so do those that change
the packages it depends on through `workspace:`, like bundled shared
code. Their types decide the bump:

| Commit | Bump |
|---|---|
| `feat` | minor |
| `fix`, `perf`, `revert`, `chore`, `docs` | patch |
| a breaking change: `feat!:` or a `BREAKING CHANGE:` footer | major, or minor before 1.0.0 |
| any other type, like `test` or `style` | none |

```text
released: @aljazmc/lintero 0.2.0 -> 0.3.0 (minor, @aljazmc/lintero@0.3.0)
tagged: @aljazmc/testero 0.2.0 (@aljazmc/testero@0.2.0)
```

With `--write`, the new version is written to the `package.json`,
committed on its own as `version: update @aljazmc/lintero to v0.3.0`,
and tagged. With `--push`, the branch and the new tags are pushed
together, all or nothing.

A version without a tag, like when monorepo is first used or after a bump
by hand, counts the commits since the commit that last changed it. It is
bumped when they call for it, and otherwise tagged as it is.

A git tag points to one commit, and all tags share one namespace, so
packages cannot share `v0.3.0`. Like npm, lerna and changesets,
monorepo tags packages with their name, as `@aljazmc/lintero@0.3.0`.
Only the root `package.json` gets a plain `v0.3.0`, and the root package
has the changes outside of the other packages.

In this repository, `.github/workflows/cicd.yml` runs `monorepo --push`
after the checks of every push to main, then publishes the versions that
are not on npm yet. The version commits are pushed with the workflow
token, which starts no new runs, and they do not count as changes.

## Tags

A rebase rewrites commits, but tags keep pointing to the old ones, both
locally and on the remote. `monorepo tags` checks every tag, local and on
the remote (`git ls-remote --tags`). When the commit of a tag is no longer
in the history of the branch, it finds the rebased commit the tag
belongs to:

```text
mangled: v0.1.5 875b883 -> 1c9d2e4 (local, origin)
unresolved: v0.1.4 1a7b34e has no rebased commit in HEAD
```

A rebased commit keeps the author, author date and subject of the commit
it replaced, and usually its change. monorepo finds it by those, or by
its patch id (`git patch-id --stable`) when it was reworded. Matches that
are not unique are not used. Tags whose commit was dropped, or changed
beyond recognition, are reported as unresolved and left alone.

Annotated tags are moved with their message, tagger and date. Signed tags
lose their signature, and are reported. Tags that exist only on the
remote are fetched before they are moved. Pushing uses `git push --force`,
so pull other changes to the tags first.

## Configuration

monorepo reads `monorepo.config.ts` or `monorepo.config.js` from the
current directory, and `--remote` and `--branch` from the command line.
Objects are merged deeply into the defaults, and anything else, like
`ignore`, replaces them:

```js
export default {
    ignore: [".git", "node_modules"],
    rules: {
        packages: ["packages/*"],
        bump: { chore: false, test: "patch" },
    },
};
```

`ignore` lists the files and folders that are never searched for
packages. The `rules` are:

| Option | Default | What it does |
|---|---|---|
| `remote` | `"origin"` | The remote that tags and versions are pushed to. |
| `branch` | `"HEAD"` | The branch whose history tags must be in, and that versions are pushed to. |
| `packages` | `[".", "packages/*"]` | The folders of the packages that are versioned on their own, `"."` for the root `package.json`. |
| `bump` | `feat: "minor"`, and `"patch"` for `fix`, `perf`, `revert`, `chore` and `docs` | The commit types that bump a version, merged with the defaults. `false` turns one off. |
| `message` | `"version: update {name} to v{version}"` | The commit message of a version. |
| `tag` | `"{name}@{version}"` | The tag of a version of a package. |
| `rootTag` | `"v{version}"` | The tag of a version of the root `package.json`. |

## How it works

```
git history
├─> src/tags.ts       finds the tags left on rebased commits, with src/history.ts, and moves them
└─> src/versions.ts   bumps, commits and tags the versions of the changed packages
```

- `src/git.ts` runs git, and lists tags with their annotations, locally and on a remote.
- `src/history.ts` finds the commits a rebase made, by author, date and subject, or by patch id.
- `src/tags.ts` plans where each tag belongs, moves the local tags and pushes them.
- `src/versions.ts` finds the packages and the commits that change them, and bumps, commits, tags and pushes their versions.
- `src/monorepo.ts` runs the commands on a repository.
- `@aljazmc/config` (`shared/config`) loads `monorepo.config.ts`, and is shared with every package.

## License

MIT, see [LICENSE](LICENSE).
