# > config

Shared, dependency-free configuration loader, file finder and glob
matcher, bundled into every `@aljazmc` package and published for their
types. Each package ships its defaults, and `<package>.config.ts` (or
`.js`) in the current directory overrides them key by key.

## > Features

| Export / member    | Description                                                     |
| ------------------ | --------------------------------------------------------------- |
| `config.custom`    | What the config file set, before the defaults were merged in.   |
| `config.files()`   | Lists the files that are not ignored.                           |
| `config.sources()` | Reads the text files that are not ignored.                      |
| `Includes`         | Matches `includes` globs: the last match decides, `!` excludes. |
| `Pattern`          | Matches a single glob.                                          |

## > Ignore patterns

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
| `{a,b}`  | Alternatives.                                           |
| name     | Any file or folder with that name, like `node_modules`. |
| path     | A path relative to the root, with its contents.         |

## > License

MIT, see [LICENSE](LICENSE).
