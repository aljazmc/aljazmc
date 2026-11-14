# > syntax

Shared, dependency-free scanner and recursive descent parser for CSS,
HTML, JavaScript, JSON, JSX, Markdown, TypeScript and YAML, bundled into
`@aljazmc/formatero` and `@aljazmc/lintero` and published for their
types. Invalid sources throw a `ParseError` with the position of the
problem.

## > Features

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

## > Usage

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

## > License

MIT, see [LICENSE](LICENSE).
