# @aljazmc/syntax

[![CI](https://github.com/aljazmc/aljazmc/actions/workflows/ci.yml/badge.svg)](https://github.com/aljazmc/aljazmc/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@aljazmc/syntax?logo=npm&color=cb3837)](https://www.npmjs.com/package/@aljazmc/syntax)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Dependencies: none](https://img.shields.io/badge/dependencies-none-brightgreen)](package.json)
[![ESTree](https://img.shields.io/badge/AST-ESTree-f7df1e?logo=javascript&logoColor=black)](https://github.com/estree/estree)
[![CommonMark + GFM](https://img.shields.io/badge/Markdown-CommonMark%20%2B%20GFM-000000?logo=markdown&logoColor=white)](https://github.github.com/gfm/)
[![Bundled](https://img.shields.io/badge/bundled%20into-formatero%20·%20lintero-6e7781)](../../README.md#packages)
[![Tests](https://img.shields.io/badge/tests-31%20passing-brightgreen)](#tests)
[![TypeScript 7](https://img.shields.io/badge/TypeScript-7%20strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

The scanner and recursive descent parsers behind formatero and lintero,
for CSS, HTML, JavaScript, JSON, JSX, Markdown, TypeScript and YAML, in
plain TypeScript. esbuild bundles this code into both packages; it is
published on npm only for its types.

## Features

- **Eight languages, one package.** Every parser is hand-written, with no
  generated grammars and no dependencies.
- **ESTree trees.** JavaScript, JSX, TypeScript and JSON parse to ESTree,
  with Babel-style literals and TypeScript nodes.
- **Comments kept.** Every parser keeps the comments, and HTML its
  whitespace, as a formatter needs them.
- **Precise errors.** Invalid sources throw a `ParseError` with the line
  and column of the problem; CSS can recover and list them instead.

| Language                    | Entry points                  | Tree                                                                               |
| --------------------------- | ----------------------------- | ---------------------------------------------------------------------------------- |
| CSS                         | `isCss`, `parseCss`           | Rules, at-rules, declarations, values and selectors, with comments.                |
| HTML                        | `isHtml`, `parseHtml`         | Elements, attributes and text, comments and whitespace as trivia.                  |
| JavaScript, JSX, TypeScript | `language`, `parse`           | ESTree, with Babel-style literals and TypeScript nodes.                            |
| JSON                        | `language`, `parse`           | ESTree expressions.                                                                |
| Markdown                    | `isMarkdown`, `parseMarkdown` | CommonMark blocks and inlines, with GitHub's tables, task lists and strikethrough. |
| YAML                        | `isYaml`, `parseYaml`         | Documents of block and flow collections and scalars, with comments in place.       |

| Helper                           | Description                                                 |
| -------------------------------- | ----------------------------------------------------------- |
| `Lines`                          | Turns offsets into 1-based lines and columns, for messages. |
| `parseCss(…, { recover: true })` | Skips items with errors and lists them in `errors`.         |
| `ParseError`                     | Thrown for invalid sources, with the position.              |
| `tagOf`                          | The known tag of an element name, like `div` for `DIV`.     |
| `Walker`                         | Lists the child nodes of a node in source order.            |

## Usage

```ts
import {
    language,
    parse,
    parseCss,
    parseHtml,
    parseMarkdown,
    parseYaml,
} from "@aljazmc/syntax";

const { program, comments } = parse("let a = <b />;", language("a.tsx"));
const sheet = parseCss("a > .b:hover { color: red; }\n");
const page = parseHtml('<p class="a">Hi <b>there</b></p>\n');
const doc = parseMarkdown("# Title\n\n- [x] done\n");
const stream = parseYaml("a:\n  - b: 1 # c\n");
```

## Tests

```sh
docker compose run --rm node yarn t:syntax
```

31 tests, run by [testero](../../packages/testero), each checking many
sources: JavaScript, JSX and TypeScript, Markdown blocks and inlines by
CommonMark, HTML, CSS and YAML, and regressions. formatero and lintero
test the parser further, through 1,898 cases of their own that compare
with Biome.

A change here is bundled into formatero and lintero, so run their tests
too: `yarn t:formatero` and `yarn t:lintero`.

## License

MIT, see [LICENSE](LICENSE).
