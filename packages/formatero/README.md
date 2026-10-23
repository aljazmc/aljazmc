![Custom](https://img.shields.io/badge/project_status-barely_working-yellow) ![Custom](https://img.shields.io/badge/breaking_changes-common-red) ![NPM Downloads](https://img.shields.io/npm/dm/%40aljazmc%2Fformatero) ![GitHub package.json version](https://img.shields.io/github/package-json/v/aljazmc/aljazmc?filename=packages%2Fformatero%2Fpackage.json&color=green) ![GitHub License](https://img.shields.io/github/license/aljazmc/aljazmc)

# > formatero

A simple, Biome-like formatter. Easy to understand, easy to customize and easy to extend.

## > usage

```sh
formatero          # list unformatted files, exit 1 if any
formatero --write  # format them in place
```

JavaScript, TypeScript, JSX and JSON are parsed and printed again with Biome-like formatting rules and line breaking, aiming for the same output as [Biome](https://biomejs.dev/formatter/). Other text files are reindented line by line, counting a tab as one level.

Rules are Biome-like, with the same names and defaults as Biome's formatter options. Override them with `formatero.config.ts` or `formatero.config.js` in the current directory; objects are merged deeply, anything else (like `ignore`) replaces the default:

```js
export default {
    ignore: [".git", "node_modules"],
    rules: {
        enabled: true,
        includes: ["**"], // globs of files to format in order, the last match decides, "!" excludes
        useEditorconfig: false, // take indentation, line endings and final newlines from .editorconfig
        indentStyle: "tab", // "tab" | "space"
        indentWidth: 2,
        lineEnding: "lf", // "lf" | "crlf" | "cr" | "auto"
        lineWidth: 80,
        trailingNewline: true,
        expand: "auto", // "auto" | "always" | "never"
        formatWithErrors: false, // format unparsable files by tokens instead of reporting them
        attributePosition: "auto", // "auto" | "multiline"
        bracketSameLine: false,
        bracketSpacing: true,
        delimiterSpacing: false,
        javascript: {
            // may also override any of the rules above, like enabled
            arrowParentheses: "always", // "always" | "asNeeded"
            jsxQuoteStyle: "double", // "double" | "single"
            operatorLinebreak: "after", // "after" | "before"
            quoteProperties: "asNeeded", // "asNeeded" | "preserve"
            quoteStyle: "double", // "double" | "single"
            semicolons: "always", // "always" | "asNeeded"
            trailingCommas: "all", // "all" | "es5" | "none"
        },
        json: {
            // may also override any of the rules above, like bracketSpacing
            trailingCommas: "none", // "all" applies to .jsonc only
        },
    },
};
```

`.editorconfig` is handled in a Biome-like way: in the current directory, it applies between the defaults and the config file, so its `indent_style`, `indent_size`, `end_of_line` and `insert_final_newline` apply unless `formatero.config.ts` sets them.

## > how it works

- `@aljazmc/syntax` (`shared/syntax`): parses sources into syntax trees and walks them, shared with lintero
- `@aljazmc/config` (`shared/config`): loads `formatero.config.ts`, finds the files and matches `includes`, shared with every package
- `src/editorconfig.ts`: reads the Biome-like rules from `.editorconfig`
- `src/printer/doc.ts`, `src/printer/layout.ts`: documents with groups, indentation and line breaks, laid out within the line width, after Wadler's "A prettier printer"
- `src/printer/javascript`: turns syntax trees into documents, one section per kind of syntax, attaching comments and choosing Biome-like layouts
- `src/tokens`, `src/rules`: a token stream and the token based rules applied to it, used for files that do not parse when `formatWithErrors` is on
