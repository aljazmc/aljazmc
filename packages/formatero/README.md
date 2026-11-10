![Custom](https://img.shields.io/badge/project_status-mostly_working-green) ![Custom](https://img.shields.io/badge/breaking_changes-common-red) ![NPM Downloads](https://img.shields.io/npm/dm/%40aljazmc%2Fformatero) ![GitHub package.json version](https://img.shields.io/github/package-json/v/aljazmc/aljazmc?filename=packages%2Fformatero%2Fpackage.json&color=green) ![GitHub License](https://img.shields.io/github/license/aljazmc/aljazmc)

# formatero

A simple formatter for JavaScript, TypeScript, JSX, JSON, Markdown, HTML
and CSS, with options and defaults compatible with
[Biome](https://biomejs.dev) 2.6.6's formatter. Easy to understand, easy
to customize and easy to extend.

## Install

```sh
npm install --save-dev @aljazmc/formatero
```

formatero needs Node.js 22 (22.18 or later), 24 (24.2 or later), 25 or 26.

## Usage

```sh
formatero              # list the unformatted files, exit 1 if there are any
formatero --write      # format them in place
formatero --config     # write the defaults to formatero.config.ts
formatero --config js  # or to formatero.config.js
```

JavaScript, TypeScript, JSX and JSON files are parsed and printed again,
with long lines broken to fit the line width. Markdown files, `.md` and
`.markdown`, keep their text and line breaks, with normalized markers,
fences, tables and spacing, and the code of their fences formatted like
files of its language. HTML files, `.html` and `.htm`, are formatted
like Biome formats them when `html.enabled` is set, see
[below](#html). CSS files, `.css`, are formatted like Biome formats
them, see [below](#css). Other text files are only reindented, line by
line, counting a tab as one level.

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

| Option            | Default  | What it does                                                                                            |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `includes`        | `["**"]` | Globs of the files to format, in order. The last match decides, and `!` excludes.                       |
| `useEditorconfig` | `false`  | Takes indentation, line endings and the final newline from `.editorconfig`, see [below](#editorconfig). |

### Every language

These options apply to every language. The `javascript`, `json`,
`markdown`, `html` and `css` sections can set them again, for that
language only.

| Option              | Default  | Values                             | What it does                                                                                                                                                                                                                                                     |
| ------------------- | -------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`           | `true`   |                                    | Formats files at all.                                                                                                                                                                                                                                            |
| `indentStyle`       | `"tab"`  | `"tab"`, `"space"`                 | Indents with tabs or with spaces.                                                                                                                                                                                                                                |
| `indentWidth`       | `2`      | a number                           | The number of spaces in a level of indentation.                                                                                                                                                                                                                  |
| `lineEnding`        | `"lf"`   | `"lf"`, `"crlf"`, `"cr"`, `"auto"` | The line endings to write, `"auto"` uses those of the operating system.                                                                                                                                                                                          |
| `lineWidth`         | `80`     | a number                           | The width that long lines are broken to fit.                                                                                                                                                                                                                     |
| `trailingNewline`   | `true`   |                                    | Ends every file with a newline.                                                                                                                                                                                                                                  |
| `expand`            | `"auto"` | `"auto"`, `"always"`, `"never"`    | When objects and arrays are written one item per line: `"auto"` keeps them that way when the source breaks the line after the opening bracket, `"always"` always does, and `"never"` only when they do not fit. `package.json` is always expanded with `"auto"`. |
| `formatWithErrors`  | `false`  |                                    | Formats files that do not parse by their tokens, instead of reporting them.                                                                                                                                                                                      |
| `attributePosition` | `"auto"` | `"auto"`, `"multiline"`            | `"multiline"` puts each JSX or HTML attribute on a line of its own when there are several, `"auto"` only when they do not fit.                                                                                                                                   |
| `bracketSameLine`   | `false`  |                                    | Puts the `>` of a multi-line JSX or HTML tag at the end of its last line, instead of on a line of its own.                                                                                                                                                       |
| `bracketSpacing`    | `true`   |                                    | Spaces inside braces: `{ a }` instead of `{a}`.                                                                                                                                                                                                                  |
| `delimiterSpacing`  | `false`  |                                    | Spaces inside parentheses, brackets, type arguments and template interpolations, and after `!`, and inside the parentheses and brackets of CSS.                                                                                                                  |

### JavaScript, TypeScript and JSX

These options are set in the `javascript` section.

| Option              | Default      | Values                     | What it does                                                                             |
| ------------------- | ------------ | -------------------------- | ---------------------------------------------------------------------------------------- |
| `arrowParentheses`  | `"always"`   | `"always"`, `"asNeeded"`   | Parentheses around a single arrow function parameter: `(a) => a` or `a => a`.            |
| `jsxQuoteStyle`     | `"double"`   | `"double"`, `"single"`     | The quotes of JSX attributes.                                                            |
| `operatorLinebreak` | `"after"`    | `"after"`, `"before"`      | Breaks long binary expressions after their operators, or before them.                    |
| `quoteProperties`   | `"asNeeded"` | `"asNeeded"`, `"preserve"` | Removes the quotes from object keys that do not need them, or keeps them as written.     |
| `quoteStyle`        | `"double"`   | `"double"`, `"single"`     | The quotes of strings.                                                                   |
| `semicolons`        | `"always"`   | `"always"`, `"asNeeded"`   | Ends every statement with a semicolon, or only those that need one.                      |
| `trailingCommas`    | `"all"`      | `"all"`, `"es5"`, `"none"` | Trailing commas in multi-line lists: everywhere, only where ES5 allows them, or nowhere. |

### JSON

These options are set in the `json` section.

| Option           | Default  | Values            | What it does                                                                                              |
| ---------------- | -------- | ----------------- | --------------------------------------------------------------------------------------------------------- |
| `trailingCommas` | `"none"` | `"none"`, `"all"` | Trailing commas in multi-line lists. `"all"` applies to `.jsonc` files only, as JSON does not allow them. |

### Markdown

These options are set in the `markdown` section.

| Option         | Default      | Values                              | What it does                                                                                                                                      |
| -------------- | ------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `proseWrap`    | `"preserve"` | `"preserve"`, `"always"`, `"never"` | Keeps the line breaks of paragraphs, wraps paragraphs at the line width, or puts each on one line, also inside emphasis. Hard breaks always stay. |
| `formatEmbeds` | `true`       |                                     | Formats fenced code in JavaScript, TypeScript, JSX, JSON, Markdown, HTML and CSS, unless it does not parse. Code in other languages stays.        |

Like Biome, formatero writes headings with `#`, list items with `-`, and
`*` or `)` for the next list beside them, numbers lists like their first
items, italics with `_` and bold with `**`, thematic breaks as `---` and
fences with backticks. It aligns tables and code spans, and keeps one
blank line between blocks, also before a heading, a fence, a list or a
quote that interrupts a paragraph, and all of them after an HTML comment.
Quotes keep the indentation before their `>`, unless a paragraph in them
continues on another line.

### HTML

These options are set in the `html` section. Like Biome, formatting HTML
is off unless `enabled` is set, and HTML ends with a newline unless the
`html` section sets `trailingNewline` to `false`.

| Option                  | Default   | Values                          | What it does                                                                                                                                                                              |
| ----------------------- | --------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`               | `false`   |                                 | Formats HTML files.                                                                                                                                                                       |
| `trailingNewline`       | `true`    |                                 | Ends HTML files with a newline, whatever the shared option says.                                                                                                                          |
| `indentScriptAndStyle`  | `false`   |                                 | Indents the content of `<script>` and `<style>` by one level.                                                                                                                             |
| `selfCloseVoidElements` | `"never"` | `"never"`, `"always"`           | Writes void elements like `<br>`, or like `<br />`.                                                                                                                                       |
| `whitespaceSensitivity` | `"css"`   | `"css"`, `"strict"`, `"ignore"` | Whether whitespace inside and around elements may render: by their CSS display, like inline elements but not blocks, always, or never. formatero only adds or removes it where it cannot. |

Like Biome, formatero lower-cases the names of HTML elements and their
attributes, quotes attribute values, prefers double quotes, breaks
`srcset` and `<iframe allow>` into lines, keeps `<pre>`, `<textarea>` and
the content of unknown scripts as written, and formats scripts as
JavaScript, and import maps and JSON scripts as JSON, and styles as CSS,
of any type like Biome. An element or text after a
`<!-- biome-ignore format: reason -->` comment, and a file with a
`<!-- biome-ignore-all format: reason -->` comment, stay as written.

### CSS

These options are set in the `css` section. Like Biome, formatero formats
`.css` files and the content of `<style>` in HTML, not SCSS.

| Option       | Default    | Values                 | What it does                                                                                    |
| ------------ | ---------- | ---------------------- | ----------------------------------------------------------------------------------------------- |
| `quoteStyle` | `"double"` | `"double"`, `"single"` | The quotes of strings, unless the other quote needs fewer escapes. `@charset` keeps its quotes. |

Like Biome, formatero puts each declaration and each selector of a list
on a line of its own, lower-cases property names, at-rule names, pseudo
classes, units, hex colors and `!important`, keeps the case of type
selectors, functions and other values, writes numbers like `0.5` and
`1e3`, quotes attribute values, and spaces combinators, `/` and the
features of media queries. Values with several comma separated parts,
like `transition`, get one line each, long ones fill lines, `calc()`
breaks after its operators, and grid templates keep their lines.
Comments and one blank line between items stay. A rule or declaration
after a `/* biome-ignore format: reason */` comment, and a file with a
`/* biome-ignore-all format: reason */` comment, stay as written, and a
file that does not parse, or whose comment would be lost, is reported
instead.

### .editorconfig

With `useEditorconfig: true`, formatero reads `.editorconfig` from the
current directory. Its `indent_style`, `indent_size`, `end_of_line` and
`insert_final_newline` override the defaults, and `formatero.config.ts`
overrides them in turn. Section globs match like Biome's: `*` and `?`
stay in a folder, `**` crosses folders, `[ab]`, `{a,b}` and `{1..3}`
match alternatives, and a single unmatched brace makes every brace
literal.

## How it works

```
source
├─> @aljazmc/syntax          parses it into a syntax tree
├─> src/printer/javascript   turns the tree into a document
├─> src/printer/markdown.ts  or prints the blocks of Markdown, and their code by its language
├─> src/printer/html         or turns HTML into Biome's formatting IR, and prints it
├─> src/printer/css.ts       or turns CSS into a document, like Biome lays it out
├─> src/printer/layout.ts    lays the document out within lineWidth
└─> src/tokens, src/rules    with formatWithErrors, format a file that does not parse
```

- `@aljazmc/syntax` (`shared/syntax`) parses sources into syntax trees, and is shared with lintero.
- `@aljazmc/config` (`shared/config`) loads `formatero.config.ts`, finds the files and matches `includes`, and is shared with every package.
- `src/printer/javascript` turns syntax trees into documents, with one section per kind of syntax, attaching comments and choosing layouts.
- `src/printer/markdown.ts` prints Markdown trees line by line, keeping their text, separating their blocks and aligning list items, quotes and tables like Biome.
- `src/printer/html` splits HTML children into words, whitespace and elements like Biome, decides where whitespace may render by their CSS display, and prints Biome's formatting IR with a port of Biome's printer, whose spaces wait for the next text. Scripts are formatted by `src/printer/javascript` and styles by `src/printer/css.ts`, indented like the element.
- `src/printer/css.ts` prints CSS rules, at-rules and declarations, choosing Biome's layout for each value list, query and selector, and keeps comments where they are written.
- `src/printer/doc.ts` and `src/printer/layout.ts` define documents of groups, indentation and line breaks, and lay them out within the line width, after Wadler's "A prettier printer".
- `src/tokens` and `src/rules` are a token stream and the rules applied to it, for files that do not parse when `formatWithErrors` is on.
- `src/editorconfig.ts` reads formatero's options from `.editorconfig`.

## License

MIT, see [LICENSE](LICENSE).
