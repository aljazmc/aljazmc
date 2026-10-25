![Custom](https://img.shields.io/badge/project_status-mostly_working-green) ![Custom](https://img.shields.io/badge/breaking_changes-common-red) ![NPM Downloads](https://img.shields.io/npm/dm/%40aljazmc%2Fformatero) ![GitHub package.json version](https://img.shields.io/github/package-json/v/aljazmc/aljazmc?filename=packages%2Fformatero%2Fpackage.json&color=green) ![GitHub License](https://img.shields.io/github/license/aljazmc/aljazmc)

# formatero

A simple formatter for JavaScript, TypeScript, JSX and JSON, with
options and defaults compatible with [Biome](https://biomejs.dev)'s
formatter. Easy to understand, easy to customize and easy to extend.

## Install

```sh
npm install --save-dev @aljazmc/formatero
```

formatero needs Node.js 22.18 or later, or 24.2 or later.

## Usage

```sh
formatero              # list the unformatted files, exit 1 if there are any
formatero --write      # format them in place
formatero --config     # write the defaults to formatero.config.ts
formatero --config js  # or to formatero.config.js
```

JavaScript, TypeScript, JSX and JSON files are parsed and printed again,
with long lines broken to fit the line width. Other text files are only
reindented, line by line, counting a tab as one level.

## Configuration

formatero reads `formatero.config.ts` or `formatero.config.js` from the
current directory. Objects are merged deeply into the defaults, and
anything else, like `ignore`, replaces them:

```js
export default {
    ignore: [".git", "node_modules"],
    rules: {
        indentStyle: "space",
        indentWidth: 4,
        javascript: { semicolons: "asNeeded" },
        json: { indentWidth: 2 },
    },
};
```

`ignore` lists the files and folders that are never formatted. The
`rules` are described below.

### Files

| Option | Default | What it does |
|---|---|---|
| `includes` | `["**"]` | Globs of the files to format, in order. The last match decides, and `!` excludes. |
| `useEditorconfig` | `false` | Takes indentation, line endings and the final newline from `.editorconfig`, see [below](#editorconfig). |

### Every language

These options apply to every language. The `javascript` and `json`
sections can set them again, for that language only.

| Option | Default | Values | What it does |
|---|---|---|---|
| `enabled` | `true` | | Formats files at all. |
| `indentStyle` | `"tab"` | `"tab"`, `"space"` | Indents with tabs or with spaces. |
| `indentWidth` | `2` | a number | The number of spaces in a level of indentation. |
| `lineEnding` | `"lf"` | `"lf"`, `"crlf"`, `"cr"`, `"auto"` | The line endings to write, `"auto"` uses those of the operating system. |
| `lineWidth` | `80` | a number | The width that long lines are broken to fit. |
| `trailingNewline` | `true` | | Ends every file with a newline. |
| `expand` | `"auto"` | `"auto"`, `"always"`, `"never"` | When objects and arrays are written one item per line: `"auto"` keeps them that way when the source breaks the line after the opening bracket, `"always"` always does, and `"never"` only when they do not fit. `package.json` is always expanded with `"auto"`. |
| `formatWithErrors` | `false` | | Formats files that do not parse by their tokens, instead of reporting them. |
| `attributePosition` | `"auto"` | `"auto"`, `"multiline"` | `"multiline"` puts each JSX attribute on a line of its own when there are several, `"auto"` only when they do not fit. |
| `bracketSameLine` | `false` | | Puts the `>` of a multi-line JSX tag at the end of its last line, instead of on a line of its own. |
| `bracketSpacing` | `true` | | Spaces inside braces: `{ a }` instead of `{a}`. |
| `delimiterSpacing` | `false` | | Spaces inside parentheses, brackets, type arguments and template interpolations, and after `!`. |

### JavaScript, TypeScript and JSX

These options are set in the `javascript` section.

| Option | Default | Values | What it does |
|---|---|---|---|
| `arrowParentheses` | `"always"` | `"always"`, `"asNeeded"` | Parentheses around a single arrow function parameter: `(a) => a` or `a => a`. |
| `jsxQuoteStyle` | `"double"` | `"double"`, `"single"` | The quotes of JSX attributes. |
| `operatorLinebreak` | `"after"` | `"after"`, `"before"` | Breaks long binary expressions after their operators, or before them. |
| `quoteProperties` | `"asNeeded"` | `"asNeeded"`, `"preserve"` | Removes the quotes from object keys that do not need them, or keeps them as written. |
| `quoteStyle` | `"double"` | `"double"`, `"single"` | The quotes of strings. |
| `semicolons` | `"always"` | `"always"`, `"asNeeded"` | Ends every statement with a semicolon, or only those that need one. |
| `trailingCommas` | `"all"` | `"all"`, `"es5"`, `"none"` | Trailing commas in multi-line lists: everywhere, only where ES5 allows them, or nowhere. |

### JSON

These options are set in the `json` section.

| Option | Default | Values | What it does |
|---|---|---|---|
| `trailingCommas` | `"none"` | `"none"`, `"all"` | Trailing commas in multi-line lists. `"all"` applies to `.jsonc` files only, as JSON does not allow them. |

### .editorconfig

With `useEditorconfig: true`, formatero reads `.editorconfig` from the
current directory. Its `indent_style`, `indent_size`, `end_of_line` and
`insert_final_newline` override the defaults, and `formatero.config.ts`
overrides them in turn.

## How it works

```
source
├─> @aljazmc/syntax          parses it into a syntax tree
├─> src/printer/javascript   turns the tree into a document
├─> src/printer/layout.ts    lays the document out within lineWidth
└─> src/tokens, src/rules    with formatWithErrors, format a file that does not parse
```

- `@aljazmc/syntax` (`shared/syntax`) parses sources into syntax trees, and is shared with lintero.
- `@aljazmc/config` (`shared/config`) loads `formatero.config.ts`, finds the files and matches `includes`, and is shared with every package.
- `src/printer/javascript` turns syntax trees into documents, with one section per kind of syntax, attaching comments and choosing layouts.
- `src/printer/doc.ts` and `src/printer/layout.ts` define documents of groups, indentation and line breaks, and lay them out within the line width, after Wadler's "A prettier printer".
- `src/tokens` and `src/rules` are a token stream and the rules applied to it, for files that do not parse when `formatWithErrors` is on.
- `src/editorconfig.ts` reads formatero's options from `.editorconfig`.

## License

MIT, see [LICENSE](LICENSE).
