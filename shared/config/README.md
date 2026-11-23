# @aljazmc/config

[![CI/CD](https://github.com/aljazmc/aljazmc/actions/workflows/cicd.yml/badge.svg)](https://github.com/aljazmc/aljazmc/actions/workflows/cicd.yml)
[![npm](https://img.shields.io/npm/v/@aljazmc/config?logo=npm&color=cb3837)](https://www.npmjs.com/package/@aljazmc/config)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Dependencies: none](https://img.shields.io/badge/dependencies-none-brightgreen)](package.json)
[![Bundled](https://img.shields.io/badge/bundled%20into-formatero%20·%20lintero%20·%20monorepo%20·%20testero-6e7781)](../../README.md#packages)
[![Tests](https://img.shields.io/badge/tests-28%20passing-brightgreen)](#tests)
[![TypeScript 7](https://img.shields.io/badge/TypeScript-7%20strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

The configuration loader, file finder and glob matcher every `@aljazmc`
tool shares. Each tool ships its defaults, and `<tool>.config.ts` (or
`.js`) in the current directory overrides them key by key. esbuild bundles
this code into each package; it is published on npm only for its types.

## Features

- **TypeScript config files.** `<tool>.config.ts` or `.js`, merged deeply
  over the defaults, with `--config` writing the defaults out.
- **gitignore-like ignores.** Names, root-anchored paths, folder-only
  patterns, `**` and `{a,b}` alternatives.
- **Biome-style includes.** The last matching glob decides, `!` excludes.
- **Robust file walking.** Follows symlinks, skips binary files, and warns
  about broken links, unreadable folders and files that are not UTF-8.

| Export / member    | Description                                                     |
| ------------------ | --------------------------------------------------------------- |
| `config.custom`    | What the config file set, before the defaults were merged in.   |
| `config.files()`   | Lists the files that are not ignored.                           |
| `config.sources()` | Reads the text files that are not ignored.                      |
| `config.within()`  | Matches files in the paths given on the command line.           |
| `Includes`         | Matches `includes` globs: the last match decides, `!` excludes. |
| `Pattern`          | Matches a single glob.                                          |

## Ignore patterns

```js
// testero.config.js
export default {
    ignore: [
        "**/tmp/*.ts",
        "*.log",
        "node_modules",
        "packages/*/bin",
        "packages/testero/tests",
    ],
};
```

| Pattern  | Matches                                                 |
| -------- | ------------------------------------------------------- |
| `**`     | Any number of segments.                                 |
| `*`, `?` | Any characters, or one character, within a segment.     |
| `/name`  | `name` at the root only, like `./name`.                 |
| `name/`  | Folders only, with their contents.                      |
| `{a,b}`  | Alternatives.                                           |
| name     | Any file or folder with that name, like `node_modules`. |
| path     | A path relative to the root, with its contents.         |

Symlinks are followed. Binary files are skipped. Broken symlinks,
unreadable folders and files that are not UTF-8 are skipped with a
warning.

## Tests

```sh
docker compose run --rm node yarn t:config
```

28 tests, run by [testero](../../packages/testero), in three files:
`ignore.test.ts` and `includes.test.ts` for the patterns, and
`config.test.ts` for loading and merging config files, `--config` and
finding files on a temporary folder, symlinks and unreadable files
included.

A change here is bundled into every package, so run the tests of the
packages too: `yarn t:all`.

## License

MIT, see [LICENSE](LICENSE).
