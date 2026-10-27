# > syntax

Shared, dependency-free scanner and recursive descent parser for JavaScript,
TypeScript, JSX, JSON and Markdown, bundled into `@aljazmc/formatero` and `@aljazmc/lintero`, and published for their
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
