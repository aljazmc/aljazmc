![Custom](https://img.shields.io/badge/project_status-mostly_working-green) ![Custom](https://img.shields.io/badge/breaking_changes-common-red) ![NPM Downloads](https://img.shields.io/npm/dm/%40aljazmc%2Fformatero) ![GitHub package.json version](https://img.shields.io/github/package-json/v/aljazmc/aljazmc?filename=packages%2Fformatero%2Fpackage.json&color=green) ![GitHub License](https://img.shields.io/github/license/aljazmc/aljazmc)

# > formatero

A simple, dependency-free formatter for CSS, HTML, JavaScript, JSON, JSX,
Markdown and TypeScript. Easy to understand, easy to customize and easy
to extend. Biome 2.6.6 compatible.

## > Features

| Feature                     | Description                                                               |
| --------------------------- | ------------------------------------------------------------------------- |
| `.editorconfig`             | Optionally takes indentation, line endings and final newline from it.     |
| CSS                         | Formats `.css` files and `<style>` content, one declaration per line.     |
| Error tolerance             | With `formatWithErrors`, formats files that do not parse by their tokens. |
| HTML                        | Opt-in, formats `.html` and `.htm` files with their scripts and styles.   |
| JavaScript, JSX, TypeScript | Reprints the syntax tree, breaking long lines to fit `lineWidth`.         |
| JSON                        | Reprints `.json` and `.jsonc` files, `package.json` always expanded.      |
| Markdown                    | Normalizes markers, fences, tables and spacing, and formats fenced code.  |
| Other text files            | Reindented line by line.                                                  |
| Suppressions                | `formatero-ignore` comments keep a CSS or HTML item, or file, as written. |

## > Install

```sh
npm install --save-dev @aljazmc/formatero
```

Requires Node.js 22.18+, 24.2+, 25 or 26.

## > Usage

| Command                   | Description                                             |
| ------------------------- | ------------------------------------------------------- |
| `formatero`               | Lists unformatted files, exits with 1 if there are any. |
| `formatero --config [js]` | Writes the defaults to `formatero.config.ts` (`.js`).   |
| `formatero --write`       | Formats the files in place.                             |

## > Configuration

`formatero.config.ts` (or `.js`) in the current directory overrides the
defaults: objects are merged deeply, anything else, like `ignore`, is
replaced. Language sections (`css`, `html`, `javascript`, `json`,
`markdown`) can override any shared option for their language.

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

### > Shared options

| Option              | Default  | Values                             | Description                                                     |
| ------------------- | -------- | ---------------------------------- | --------------------------------------------------------------- |
| `attributePosition` | `"auto"` | `"auto"`, `"multiline"`            | One JSX or HTML attribute per line always, or only when needed. |
| `bracketSameLine`   | `false`  | boolean                            | Puts the `>` of a multi-line tag at the end of its last line.   |
| `bracketSpacing`    | `true`   | boolean                            | Writes `{ a }` instead of `{a}`.                                |
| `delimiterSpacing`  | `false`  | boolean                            | Spaces inside parentheses, brackets and interpolations.         |
| `enabled`           | `true`   | boolean                            | Formats files at all.                                           |
| `expand`            | `"auto"` | `"always"`, `"auto"`, `"never"`    | When objects and arrays get one item per line.                  |
| `formatWithErrors`  | `false`  | boolean                            | Formats files that do not parse by their tokens.                |
| `includes`          | `["**"]` | globs                              | Files to format, the last match decides, `!` excludes.          |
| `indentStyle`       | `"tab"`  | `"space"`, `"tab"`                 | Indents with tabs or spaces.                                    |
| `indentWidth`       | `2`      | number                             | Spaces per indentation level.                                   |
| `lineEnding`        | `"lf"`   | `"auto"`, `"cr"`, `"crlf"`, `"lf"` | Line endings, `"auto"` uses the operating system's.             |
| `lineWidth`         | `80`     | number                             | The width long lines are broken to fit.                         |
| `trailingNewline`   | `true`   | boolean                            | Ends every file with a newline.                                 |
| `useEditorconfig`   | `false`  | boolean                            | Reads `.editorconfig`, the config file still overrides it.      |

### > Language options

| Section      | Option                  | Default      | Values                              | Description                                              |
| ------------ | ----------------------- | ------------ | ----------------------------------- | -------------------------------------------------------- |
| `css`        | `quoteStyle`            | `"double"`   | `"double"`, `"single"`              | Quotes of strings, unless the other needs fewer escapes. |
| `html`       | `enabled`               | `false`      | boolean                             | Formats HTML files, off by default.                      |
| `html`       | `indentScriptAndStyle`  | `false`      | boolean                             | Indents `<script>` and `<style>` content one level.      |
| `html`       | `selfCloseVoidElements` | `"never"`    | `"always"`, `"never"`               | Writes `<br>` or `<br />`.                               |
| `html`       | `whitespaceSensitivity` | `"css"`      | `"css"`, `"ignore"`, `"strict"`     | Where whitespace around elements may render.             |
| `javascript` | `arrowParentheses`      | `"always"`   | `"always"`, `"asNeeded"`            | Writes `(a) => a` or `a => a`.                           |
| `javascript` | `jsxQuoteStyle`         | `"double"`   | `"double"`, `"single"`              | Quotes of JSX attributes.                                |
| `javascript` | `operatorLinebreak`     | `"after"`    | `"after"`, `"before"`               | Breaks binary expressions after or before operators.     |
| `javascript` | `quoteProperties`       | `"asNeeded"` | `"asNeeded"`, `"preserve"`          | Removes needless quotes from object keys, or keeps them. |
| `javascript` | `quoteStyle`            | `"double"`   | `"double"`, `"single"`              | Quotes of strings.                                       |
| `javascript` | `semicolons`            | `"always"`   | `"always"`, `"asNeeded"`            | Semicolons after every statement, or only as needed.     |
| `javascript` | `trailingCommas`        | `"all"`      | `"all"`, `"es5"`, `"none"`          | Trailing commas in multi-line lists.                     |
| `json`       | `trailingCommas`        | `"none"`     | `"all"`, `"none"`                   | Trailing commas, `"all"` in `.jsonc` files only.         |
| `markdown`   | `formatEmbeds`          | `true`       | boolean                             | Formats fenced code in supported languages.              |
| `markdown`   | `proseWrap`             | `"preserve"` | `"always"`, `"never"`, `"preserve"` | Wraps paragraphs at the line width, joins or keeps them. |

### > Suppressions

In CSS and HTML, a suppression comment keeps the next item, or the whole
file, as written. `biome-ignore` is accepted as a synonym of
`formatero-ignore`.

```html
<!-- formatero-ignore format: keeps the next node as written -->
<!-- formatero-ignore-all format: keeps the whole file as written -->
```

```css
/* formatero-ignore format: keeps the next rule or declaration as written */
/* formatero-ignore-all format: keeps the whole file as written */
```

## > How it works

```
source
├─> @aljazmc/syntax          parses it into a syntax tree
├─> src/printer/*            turns the tree into a document, per language
├─> src/printer/layout.ts    lays the document out within lineWidth
└─> src/tokens, src/rules    formats files that do not parse, with formatWithErrors
```

| Module                    | Description                                                      |
| ------------------------- | ---------------------------------------------------------------- |
| `@aljazmc/config`         | Loads `formatero.config.ts`, finds files and matches `includes`. |
| `@aljazmc/syntax`         | Parses sources into syntax trees.                                |
| `src/editorconfig.ts`     | Reads options from `.editorconfig`.                              |
| `src/printer/css.ts`      | Prints CSS rules, at-rules, declarations and selectors.          |
| `src/printer/doc.ts`      | Documents of groups, indentation and line breaks.                |
| `src/printer/html`        | Prints HTML, with embedded scripts and styles.                   |
| `src/printer/javascript`  | Prints JavaScript, JSX, JSON and TypeScript trees.               |
| `src/printer/layout.ts`   | Lays documents out within the line width (Wadler's algorithm).   |
| `src/printer/markdown.ts` | Prints Markdown blocks, and fenced code by its language.         |
| `src/tokens`, `src/rules` | Token stream and rules for files that do not parse.              |

## > License

MIT, see [LICENSE](LICENSE).
