![Custom](https://img.shields.io/badge/project_status-mostly_working-green) ![Custom](https://img.shields.io/badge/breaking_changes-common-red) ![NPM Downloads](https://img.shields.io/npm/dm/%40aljazmc%2Fformatero) ![GitHub package.json version](https://img.shields.io/github/package-json/v/aljazmc/aljazmc?filename=packages%2Fformatero%2Fpackage.json&color=green) ![GitHub License](https://img.shields.io/github/license/aljazmc/aljazmc)

# > formatero

A simple formatter for JavaScript, TypeScript, JSX and JSON. Easy to understand, easy to customize and easy to extend.

## > Install

```sh
npm install --save-dev @aljazmc/formatero
```

## > Usage

```sh
formatero              # list unformatted files, exit 1 if any
formatero --write      # format them in place
formatero --config     # write the defaults to formatero.config.ts
formatero --config js  # or to formatero.config.js
```

formatero parses JavaScript, TypeScript, JSX and JSON files and prints them again, breaking lines to fit the line width. Other text files are reindented line by line, counting a tab as one level.

## > Configuration

formatero reads `formatero.config.ts` or `formatero.config.js` from the current directory. Objects are merged deeply into the defaults, anything else (like `ignore`) replaces them:

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

### .editorconfig

With `useEditorconfig: true`, formatero reads `.editorconfig` from the current directory. Its `indent_style`, `indent_size`, `end_of_line` and `insert_final_newline` apply on top of the defaults, and `formatero.config.ts` still overrides them.

## > How it works

- `@aljazmc/syntax` (`shared/syntax`): parses sources into syntax trees and walks them, shared with lintero
- `@aljazmc/config` (`shared/config`): loads `formatero.config.ts`, finds the files and matches `includes`, shared with every package
- `src/editorconfig.ts`: reads formatero's rules from `.editorconfig`
- `src/printer/doc.ts`, `src/printer/layout.ts`: documents with groups, indentation and line breaks, laid out within the line width, after Wadler's "A prettier printer"
- `src/printer/javascript`: turns syntax trees into documents, one section per kind of syntax, attaching comments and choosing layouts
- `src/tokens`, `src/rules`: a token stream and the token based rules applied to it, used for files that do not parse when `formatWithErrors` is on
