# > syntax

Shared, dependency-free scanner and recursive descent parser for JavaScript,
TypeScript, JSX and JSON, bundled into `@aljazmc/formatero` and `@aljazmc/lintero`.

```ts
import { language, parse } from "@aljazmc/syntax";

const options = language("a.tsx"); // { json: false, typescript: true, jsx: true }
const { program, comments } = parse("let a = <b />;", options);
```

Syntax trees follow ESTree, with Babel-style literals and TypeScript nodes.
Invalid sources throw `ParseError` with the position of the problem.

`Walker.children(node)` lists the child nodes of a node in source order, and
`Lines` turns offsets into 1-based lines and columns, for messages.
