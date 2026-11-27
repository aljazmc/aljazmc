# formatero

[![CI](https://github.com/aljazmc/aljazmc/actions/workflows/ci.yml/badge.svg)](https://github.com/aljazmc/aljazmc/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@aljazmc/formatero?logo=npm&color=cb3837)](https://www.npmjs.com/package/@aljazmc/formatero)
[![npm downloads](https://img.shields.io/npm/dm/@aljazmc/formatero?logo=npm&color=cb3837&label=downloads)](https://www.npmjs.com/package/@aljazmc/formatero)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/node/v/@aljazmc/formatero?logo=nodedotjs&logoColor=white&color=5fa04e)](https://nodejs.org/)
[![Third-party dependencies: none](https://img.shields.io/badge/third--party%20dependencies-none-brightgreen)](package.json)
[![Biome 2.6.6 compatible](https://img.shields.io/badge/Biome-2.6.6%20compatible-60a5fa?logo=biome&logoColor=white)](https://biomejs.dev/formatter/)
[![Tests](https://img.shields.io/badge/tests-270%20passing-brightgreen)](#tests)
[![TypeScript 7](https://img.shields.io/badge/TypeScript-7%20strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

A dependency-free code formatter for CSS, HTML, JavaScript, JSON, JSX,
Markdown, TypeScript and YAML, written in TypeScript. It takes the same
options as [Biome](https://biomejs.dev/) 2.6.6 and prints the same output,
so a project formatted by Biome stays as it is.

```sh
npx @aljazmc/formatero --write
```

## Features

- **Eight languages, one tool.** CSS, HTML, JavaScript, JSON, JSX,
  Markdown, TypeScript and YAML, plus fenced code in Markdown and scripts
  and styles in HTML, each by the rules of its own language.
- **Biome compatible.** The same output and the same option names,
  checked against what Biome 2.6.6 itself prints for 117 test cases.
- **Lays out like Prettier and Biome.** Sources are reprinted from a
  syntax tree and broken to fit `lineWidth` with Wadler's algorithm.
- **Tolerates errors.** With `formatWithErrors`, files that do not parse
  are still formatted by their tokens.
- **Respects `.editorconfig`.** Indentation, line endings and the final
  newline can come from it.
- **Nothing else to install.** No third-party packages: the parser is
  [`@aljazmc/syntax`](../../shared/syntax), bundled in.

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
| YAML                        | Reprints `.yml` and `.yaml` files by their structure, keeping values.     |

## Quick start

```sh
npm install --save-dev @aljazmc/formatero
npx formatero --config   # writes the defaults to formatero.config.ts
npx formatero            # lists unformatted files
npx formatero --write    # formats them in place
```

Requires Node.js 22.18+, 24.2+, 25 or 26.

## Usage

| Command                   | Description                                             |
| ------------------------- | ------------------------------------------------------- |
| `formatero`               | Lists unformatted files, exits with 1 if there are any. |
| `formatero --config [js]` | Writes the defaults to `formatero.config.ts` (`.js`).   |
| `formatero --write`       | Formats the files in place.                             |
| `formatero [paths]`       | Only the files in these files or folders.               |

## Configuration

`formatero.config.ts` (or `.js`) in the current directory overrides the
defaults: objects are merged deeply, anything else, like `ignore`, is
replaced. Language sections (`css`, `html`, `javascript`, `json`,
`markdown`, `yaml`) can override any shared option for their language.

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

### Shared options

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

### Language options

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
| `yaml`       | `bracketSpacing`        | unset        | boolean                             | Spaces in flow sequences too, or in neither.             |
| `yaml`       | `quoteStyle`            | `"double"`   | `"double"`, `"single"`              | Quotes of scalars, unless the other needs fewer escapes. |

### YAML

YAML is formatted like Biome formats it:

- Collections are indented by `indentWidth`, sequences under keys too.
- Single spaces go after `:` and `-` and before comments.
- Quoted scalars get the preferred quotes when that needs no more escapes.
- Flow collections are spaced, and broken with trailing commas when long.
- Block scalars move with their content.

YAML is always indented with spaces, as it has no tabs. Unless
`yaml.bracketSpacing` is set, flow mappings follow `bracketSpacing` and
flow sequences have no spaces, like Biome's defaults.

Two things differ from Biome on purpose:

- When the indentation of a key with an indentation indicator, like `|2`,
  changes, its content moves along with it. Biome leaves the content where
  it was, which changes the value.
- A comment deeper than an entry, after its block scalar, stays at the
  entry's indentation. Biome moves it to the first column, and moves it
  back when it formats the result again.

### Suppressions

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

## How it works

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
| `src/printer/yaml.ts`     | Prints YAML documents, block and flow collections and scalars.   |
| `src/tokens`, `src/rules` | Token stream and rules for files that do not parse.              |

## Tests

```sh
docker compose run --rm node yarn t:formatero       # all 270 tests
docker compose run --rm node yarn tunit:formatero   # the unit tests only
docker compose run --rm node yarn te2e:formatero    # the end-to-end tests only
docker compose run --rm node yarn record:formatero  # records Biome 2.6.6 again
```

270 tests, run by [testero](../testero). Most of them are table-driven
with `test.each`, so one `test` in the source can be many tests in the
results:

| Suite               | Tests | Checks                                                      |
| ------------------- | ----- | ----------------------------------------------------------- |
| `prints like Biome` | 117   | Each input prints as Biome prints it, and formats stably.   |
| `layout`            | 3     | Groups, indentation and line breaks within the line width.  |
| `errors`            | 3     | Files that do not parse, formatted with `formatWithErrors`. |
| `files`             | 9     | Finding, checking and writing files on disk.                |
| `editorconfig`      | 3     | Options read from `.editorconfig` and overridden by config. |
| `lines`, `yaml`     | 10    | Line endings, final newlines and YAML's own cases.          |
| `regressions`       | 7     | Bugs found once, kept from coming back.                     |

Every Biome case is formatted twice: the expected output must come out
unchanged, so formatting is idempotent.

The cases are in `tests/biome.ts`. The end-to-end test runs the built command line on
each of them, in a project of its own: checking must fail where `biome format` does,
`--write` must write what `biome format --write` wrote, and checking again must pass.
What Biome 2.6.6 itself did is recorded in `tests/e2e/biome-2.6.6.json` by
`yarn record:formatero`, which installs Biome into `.cache/`, never into the project; run
it after adding or changing a case.

| Suite                        | Tests | Checks                                           |
| ---------------------------- | ----- | ------------------------------------------------ |
| `formats what Biome formats` | 117   | The check, the write and the output are Biome's. |
| the recording                | 1     | Every case is recorded.                          |

## License

MIT, see [LICENSE](LICENSE).
