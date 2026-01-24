![Custom](https://img.shields.io/badge/project_status-barely_working-yellow) ![Custom](https://img.shields.io/badge/breaking_changes-common-red) ![NPM Downloads](https://img.shields.io/npm/dm/%40aljazmc%2Fmonorepo) ![GitHub package.json version](https://img.shields.io/github/package-json/v/aljazmc/aljazmc?filename=packages%2Fmonorepo%2Fpackage.json&color=green) ![GitHub License](https://img.shields.io/github/license/aljazmc/aljazmc)

# > monorepo

A simple monorepo management tool. Easy to understand, easy to customize and easy to extend.

## > usage

```sh
monorepo tags                  # list tags left on commits a rebase replaced, exit 1 if any
monorepo tags --write          # move the local tags to the rebased commits
monorepo tags --write --push   # also force push the moved tags to origin
```

A rebase rewrites commits, but tags keep pointing to the old ones, locally and on the remote. `monorepo tags` checks every tag, local and on the remote (`git ls-remote --tags`), and when its commit is no longer in the history of the branch, finds the rebased commit it belongs to:

```text
mangled: v0.1.5 875b883 -> 1c9d2e4 (local, origin)
unresolved: v0.1.4 1a7b34e has no rebased commit in HEAD
```

A rebased commit keeps the author, author date and subject of the one it replaced, and usually its change, so it is found by those, or by its patch id (`git patch-id --stable`) when it was reworded. Matches that are not unique are not used. Tags whose commit was dropped, or changed beyond recognition, are reported as unresolved and left alone.

Annotated tags are moved with their message, tagger and date. Signed tags lose their signature, and are reported. Tags only on the remote are fetched before they are moved. Pushing uses `git push --force`, so pull other changes to the tags first.

Settings can be overridden with `monorepo.config.ts` or `monorepo.config.js` in the current directory, or on the command line with `--remote` and `--branch`:

```js
export default {
    rules: {
        remote: "origin", // the remote whose tags are checked and pushed
        branch: "HEAD", // the branch tags must be in the history of
    },
};
```

## > how it works

- `src/git.ts`: runs git, lists tags with their annotations, locally and on a remote
- `src/history.ts`: the commits a rebase made, findable by author, date and subject, or by patch id
- `src/tags.ts`: plans where each tag belongs, moves the local tags and pushes them
- `src/monorepo.ts`: the commands, run on a repository
- `@aljazmc/config` (`shared/config`): loads `monorepo.config.ts`, shared with every package

## > achieved milestones

- setup toolchain (with continuous integration and continuous delivery, using recent tools)
- tag manipulation: moving tags to rebased commits, locally and on the remote

## > planned milestones

- formidable test coverage
- more monorepo management, like versions and publishing
