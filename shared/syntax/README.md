# > syntax

Shared, dependency-free scanner and recursive descent parser for CSS,
HTML, JavaScript, JSON, JSX, Markdown and TypeScript, bundled into `@aljazmc/formatero` and `@aljazmc/lintero`, and published for their
types.

```ts
import { language, parse } from "@aljazmc/syntax";

const options = language("a.tsx"); // { json: false, typescript: true, jsx: true }
const { program, comments } = parse("let a = <b />;", options);
```

Syntax trees follow ESTree, with Babel-style literals and TypeScript nodes.
Invalid sources throw `ParseError` with the position of the problem.

`Walker.children(node)` lists the child nodes of a node in source order, and
`Lines` turns offsets into 1-based lines and columns, for messages.

Markdown is parsed like CommonMark, with GitHub's tables, task list items
and strikethrough:

```ts
import { isMarkdown, parseMarkdown } from "@aljazmc/syntax";

isMarkdown("README.md"); // true
const root = parseMarkdown("# Title\n\n- [x] done\n");
// root.children: a Heading and a List, with their offsets and lines
```

Blocks have offsets into the source and 1-based lines, and keep what a
formatter needs to print them as written, like the indentation of each
line. Inlines have offsets into the text of their block.

HTML is parsed like Biome parses it: elements must be closed, only void
elements may have no closing tag, and whitespace and comments are trivia
between nodes, not children:

```ts
import { isHtml, parseHtml } from "@aljazmc/syntax";

isHtml("index.html"); // true
const root = parseHtml('<p class="a">Hi <b>there</b></p>\n');
// root.children: an Element p, with its attributes, a Text and an Element b
// root.comments: every <!-- --> comment
```

Element names keep their case, and `tag` is the known tag they match, like
`div` for `DIV` and `feBlend` for `feBlend`. Scripts, styles and
preformatted elements keep their content as one raw text.

CSS is parsed into rules, at-rules, declarations and their component
values, and the selectors of rules into compound selectors, combinators
and simple selectors, like Biome reads them:

```ts
import { isCss, parseCss } from "@aljazmc/syntax";

isCss("styles.css"); // true
const sheet = parseCss("a > .b:hover { color: red !important; }\n");
// sheet.children: a Rule, its selectors and a block with a Declaration
// sheet.comments: every /* */ comment
```

Nested rules, `@media` queries and other at-rule preludes keep their
values, keyframes keep theirs instead of selectors. Errors throw a
`ParseError`, or with `parseCss(source, { recover: true })` the items
with errors are skipped and listed in `sheet.errors`.
