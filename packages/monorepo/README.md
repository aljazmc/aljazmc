![Custom](https://img.shields.io/badge/project_status-barely_working-yellow) ![Custom](https://img.shields.io/badge/breaking_changes-common-red) ![NPM Downloads](https://img.shields.io/npm/dm/%40aljazmc%2Fmonorepo) ![GitHub package.json version](https://img.shields.io/github/package-json/v/aljazmc/aljazmc?filename=packages%2Fmonorepo%2Fpackage.json&color=green) ![GitHub License](https://img.shields.io/github/license/aljazmc/aljazmc)

# > monorepo

A simple monorepo management tool. Easy to understand, easy to customize and easy to extend.

## > usage

```sh
monorepo                       # tags, then version: what both would do
monorepo --push                # move tags a rebase left behind, then bump, commit, tag and push the versions
monorepo --push --dry-run      # print what it would write, move, commit, tag and push, changing nothing
monorepo version               # list the versions the changed packages need
monorepo version --write       # bump, commit and tag them
monorepo version --push        # also push the branch and the tags to origin
monorepo version --push --dry-run  # print what it would write, commit, tag and push, changing nothing
monorepo tags                  # list tags left on commits a rebase replaced, exit 1 if any
monorepo tags --write          # move the local tags to the rebased commits
monorepo tags --write --push   # also force push the moved tags to origin
```

`--dry-run` prints what `--write` and `--push` would do, without changing files, making commits, tagging or pushing; alone it shows what `--write` would do:

```text
would release: @aljazmc/lintero 0.2.0 -> 0.3.0 (minor, @aljazmc/lintero@0.3.0)
would write: packages/lintero/package.json ("version": "0.3.0")
would run: git add -- packages/lintero/package.json
would run: git commit -q -m 'version: update @aljazmc/lintero to v0.3.0' -- packages/lintero/package.json
would run: git tag -a @aljazmc/lintero@0.3.0 -m 'version: update @aljazmc/lintero to v0.3.0'
would run: git push -q --atomic origin HEAD refs/tags/@aljazmc/lintero@0.3.0
```

### versions

Each package is versioned on its own. `monorepo version` looks at the commits since the last version of each package, those that change its folder or the folders of the packages it depends on through `workspace:` (like bundled shared code), and bumps its version by [conventional commits](https://www.conventionalcommits.org): `feat` the minor version, `fix`, `perf`, `revert`, `chore` and `docs` the patch version, a breaking change (`feat!:` or a `BREAKING CHANGE:` footer) the major one, or the minor one before 1.0.0. Other commits, like `test` or `style`, bump nothing.

```text
released: @aljazmc/lintero 0.2.0 -> 0.3.0 (minor, @aljazmc/lintero@0.3.0)
tagged: @aljazmc/testero 0.2.0 (@aljazmc/testero@0.2.0)
```

With `--write`, the new version is written to the package.json, committed on its own with `version: update @aljazmc/lintero to v0.3.0`, and tagged. A version in package.json without a tag, like when monorepo is first used, or one bumped by hand, counts the commits since the commit that last changed the version: it is bumped when they call for it, else tagged as it is. With `--push`, the branch and the new tags are pushed together, all or nothing.

Git tags are names in one namespace, a tag points to one commit, so packages cannot share `v0.3.0`. Packages are tagged with their name, `@aljazmc/lintero@0.3.0` like npm, lerna and changesets do (tags cannot have spaces), only the package.json at the root gets plain `v0.3.0`. The root package has the changes outside of the other packages.

Without a command, `monorepo` runs `tags` then `version` with the same options, the usual workflow: tags left on commits a rebase replaced are moved first, as versions count the commits since the tag of each package.

In this repository, `.github/workflows/cicd.yml` runs `monorepo --push` after the checks of every push to main, then publishes the versions not on npm yet. The version commits are pushed with the workflow token, which starts no new runs, and are not counted as changes.

A rebase rewrites commits, but tags keep pointing to the old ones, locally and on the remote. `monorepo tags` checks every tag, local and on the remote (`git ls-remote --tags`), and when its commit is no longer in the history of the branch, finds the rebased commit it belongs to:

```text
mangled: v0.1.5 875b883 -> 1c9d2e4 (local, origin)
unresolved: v0.1.4 1a7b34e has no rebased commit in HEAD
```

A rebased commit keeps the author, author date and subject of the one it replaced, and usually its change, so it is found by those, or by its patch id (`git patch-id --stable`) when it was reworded. Matches that are not unique are not used. Tags whose commit was dropped, or changed beyond recognition, are reported as unresolved and left alone.

Annotated tags are moved with their message, tagger and date. Signed tags lose their signature, and are reported. Tags only on the remote are fetched before they are moved. Pushing uses `git push --force`, so pull other changes to the tags first.

Settings can be overridden with `monorepo.config.ts` or `monorepo.config.js` in the current directory, or on the command line with `--remote` and `--branch`; objects are merged deeply, anything else (like `ignore`) replaces the default:

```js
export default {
    ignore: [".git", "node_modules"], // files and folders not searched for packages
    rules: {
        remote: "origin", // the remote tags and versions are pushed to
        branch: "HEAD", // the branch tags must be in the history of, and versions are pushed to
        packages: [".", "packages/*"], // roots of packages versioned on their own, "." for the root package.json
        bump: {
            // commit types that bump, merged with these, false turns one off
            feat: "minor",
            chore: "patch",
            docs: "patch",
            fix: "patch",
            perf: "patch",
            revert: "patch",
        },
        message: "version: update {name} to v{version}", // the commit message of a version
        tag: "{name}@{version}", // the tag of a version of a package
        rootTag: "v{version}", // the tag of a version of the root package.json
    },
};
```

## > how it works

- `src/git.ts`: runs git, lists tags with their annotations, locally and on a remote
- `src/history.ts`: the commits a rebase made, findable by author, date and subject, or by patch id
- `src/tags.ts`: plans where each tag belongs, moves the local tags and pushes them
- `src/versions.ts`: finds the packages and the commits that change them, bumps, commits, tags and pushes their versions
- `src/monorepo.ts`: the commands, run on a repository
- `@aljazmc/config` (`shared/config`): loads `monorepo.config.ts`, shared with every package
