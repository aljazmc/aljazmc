# > config

Shared, dependency-free configuration loader, file finder and glob matcher, bundled
into every `@aljazmc` package.

Each package ships its defaults in `src/config.ts`. On run, `<package>.config.ts`
(or `.js`) in the current directory, if present, overrides them key by key.

```js
// testero.config.js
export default {
    ignore: [
        "node_modules", // name: any file or directory called node_modules
        "packages/testero/tests", // path: relative to root, with its contents
        "*.log", // globs: * and ? within a segment, ** across segments, {a,b} alternatives
        "packages/*/bin",
        "**/tmp/*.ts",
    ],
};
```

`config.files()` lists the files that are not ignored, and `config.sources()`
reads the text ones. `Includes` matches `includes` globs like formatero and lintero use them, where
the last matching glob decides and `!` excludes. `config.custom` holds what the
config file set, before the defaults were merged in.
