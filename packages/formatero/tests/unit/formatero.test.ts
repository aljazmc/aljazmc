import Config from "@aljazmc/config";
import defaults from "../../src/config.ts";
import EditorConfig from "../../src/editorconfig.ts";
import { formatFiles } from "../../src/files.ts";
import Formatero, { FormatError } from "../../src/formatero.ts";
import {
    conditionalGroup,
    fill,
    group,
    hardline,
    ifBreak,
    indent,
    line,
    lineSuffix,
    softline,
} from "../../src/printer/doc.ts";
import Layout from "../../src/printer/layout.ts";

const format = (source: string, file = "a.ts", rules: object = {}) =>
    new Formatero(
        Config.merge(defaults.rules, {
            indentStyle: "space",
            indentWidth: 4,
            ...rules,
        }),
    ).format(source, file);

/** Inputs with their expected output, the printer must match it. */
const biome: {
    name: string;
    file: string;
    rules: object;
    input: string;
    expected: string;
}[] = [
    {
        name: "breaks long calls, keeps short ones",
        file: "a.ts",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "foo(a, b);\nconst result = someFunction(argumentNumberOne, argumentNumberTwo, argumentNumberThree);\n",
        expected:
            "foo(a, b);\nconst result = someFunction(\n    argumentNumberOne,\n    argumentNumberTwo,\n    argumentNumberThree,\n);\n",
    },
    {
        name: "hugs a last object or function argument",
        file: "a.ts",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "useEffect(() => { document.title = title; }, [title]);\nrequest(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body });\n",
        expected:
            'useEffect(() => {\n    document.title = title;\n}, [title]);\nrequest(url, {\n    method: "POST",\n    headers: { "content-type": "application/json" },\n    body,\n});\n',
    },
    {
        name: "member chains stay short or break per call",
        file: "a.ts",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "const names = users.filter(user => user.active).map(user => user.name).sort().join(', ');\npromise.then(done);\n",
        expected:
            'const names = users\n    .filter((user) => user.active)\n    .map((user) => user.name)\n    .sort()\n    .join(", ");\npromise.then(done);\n',
    },
    {
        name: "assignments break after the operator for long strings and binaries",
        file: "a.ts",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "const message = 'a long string literal that does not fit on the line with its name';\nconst valid = isEnabled && hasPermission(user) && !isBlocked(user) && withinLimits(request);\n",
        expected:
            'const message =\n    "a long string literal that does not fit on the line with its name";\nconst valid =\n    isEnabled &&\n    hasPermission(user) &&\n    !isBlocked(user) &&\n    withinLimits(request);\n',
    },
    {
        name: "ternaries indent their branches, nested ones further",
        file: "a.ts",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "const label = count === 0 ? 'none' : count === 1 ? 'one item in the list' : `${count} items in the list`;\n",
        expected:
            'const label =\n    count === 0\n        ? "none"\n        : count === 1\n          ? "one item in the list"\n          : `${count} items in the list`;\n',
    },
    {
        name: "objects keep a line break after the opening brace",
        file: "a.ts",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "const a = {\n  b: 1, c: 2 };\nconst d = { e: 1, f: 2 };\n",
        expected:
            "const a = {\n    b: 1,\n    c: 2,\n};\nconst d = { e: 1, f: 2 };\n",
    },
    {
        name: "comments stay where they belong",
        file: "a.ts",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "// leading\nfunction f(/* no params */) {\n  return a; // trailing\n}\n/** doc\n   * comment */\nclass A {}\n",
        expected:
            "// leading\nfunction f(/* no params */) {\n    return a; // trailing\n}\n/** doc\n * comment */\nclass A {}\n",
    },
    {
        name: "blank lines are kept, at most one",
        file: "a.ts",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "a();\n\n\n\nb();\nc();\n",
        expected: "a();\n\nb();\nc();\n",
    },
    {
        name: "TypeScript declarations and types",
        file: "a.ts",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "interface Props<T extends object = {}> extends Base { readonly id: string; onChange?: (value: T) => void; [key: string]: unknown }\ntype Result<T> = { ok: true; value: T } | { ok: false; error: Error };\nenum Color { Red, Green = 'green' }\nexport abstract class Store<T> implements Repo<T> { private items: T[] = []; abstract load(id: string): Promise<T>; }\n",
        expected:
            'interface Props<T extends object = {}> extends Base {\n    readonly id: string;\n    onChange?: (value: T) => void;\n    [key: string]: unknown;\n}\ntype Result<T> = { ok: true; value: T } | { ok: false; error: Error };\nenum Color {\n    Red,\n    Green = "green",\n}\nexport abstract class Store<T> implements Repo<T> {\n    private items: T[] = [];\n    abstract load(id: string): Promise<T>;\n}\n',
    },
    {
        name: "JSX elements, attributes and text",
        file: "a.tsx",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "export const App = ({ items }) => <ul className='list'>{items.map(item => <li key={item.id} onClick={() => select(item)}>{item.label}</li>)}</ul>;\n",
        expected:
            'export const App = ({ items }) => (\n    <ul className="list">\n        {items.map((item) => (\n            <li key={item.id} onClick={() => select(item)}>\n                {item.label}\n            </li>\n        ))}\n    </ul>\n);\n',
    },
    {
        name: "lineWidth",
        file: "a.ts",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 40 },
        input: "const total = items.reduce((sum, item) => sum + item.price, 0);\n",
        expected:
            "const total = items.reduce(\n    (sum, item) => sum + item.price,\n    0,\n);\n",
    },
    {
        name: "indentStyle and indentWidth",
        file: "a.ts",
        rules: { indentStyle: "tab", indentWidth: 4, lineWidth: 80 },
        input: "function f() {\n  if (a) {\n    b();\n  }\n}\n",
        expected: "function f() {\n\tif (a) {\n\t\tb();\n\t}\n}\n",
    },
    {
        name: "quoteStyle and jsxQuoteStyle",
        file: "a.jsx",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            lineWidth: 80,
            javascript: { quoteStyle: "single", jsxQuoteStyle: "single" },
        },
        input: 'const a = "b";\nconst c = "it\'s";\nconst d = <div title="e" />;\n',
        expected:
            "const a = 'b';\nconst c = \"it's\";\nconst d = <div title='e' />;\n",
    },
    {
        name: "semicolons asNeeded",
        file: "a.ts",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            lineWidth: 80,
            javascript: { semicolons: "asNeeded" },
        },
        input: "const a = 1;\n[a].forEach(log);\nclass A { b = 1; }\n",
        expected: "const a = 1\n;[a].forEach(log)\nclass A {\n    b = 1\n}\n",
    },
    {
        name: "trailingCommas",
        file: "a.ts",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            lineWidth: 80,
            javascript: { trailingCommas: "es5" },
        },
        input: "call(argumentNumberOne, argumentNumberTwo, argumentNumberThree, four);\nconst list = [elementNumberOne, elementNumberTwo, elementNumberThree, four];\n",
        expected:
            "call(argumentNumberOne, argumentNumberTwo, argumentNumberThree, four);\nconst list = [elementNumberOne, elementNumberTwo, elementNumberThree, four];\n",
    },
    {
        name: "arrowParentheses",
        file: "a.ts",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            lineWidth: 80,
            javascript: { arrowParentheses: "asNeeded" },
        },
        input: "const f = (a) => a;\nconst g = (a: number) => a;\n",
        expected: "const f = a => a;\nconst g = (a: number) => a;\n",
    },
    {
        name: "bracketSpacing",
        file: "a.ts",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            lineWidth: 80,
            javascript: { bracketSpacing: false },
        },
        input: "import { a } from 'b';\nconst { c } = { c: 1 };\n",
        expected: 'import {a} from "b";\nconst {c} = {c: 1};\n',
    },
    {
        name: "expand",
        file: "a.ts",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            lineWidth: 80,
            expand: "always",
        },
        input: "const a = { b: 1 };\nconst c = [1, 2];\n",
        expected:
            "const a = {\n    b: 1,\n};\nconst c = [\n    1,\n    2,\n];\n",
    },
    {
        name: "bracketSameLine and attributePosition",
        file: "a.jsx",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            lineWidth: 80,
            javascript: {
                bracketSameLine: true,
                attributePosition: "multiline",
            },
        },
        input: "const a = <Button variant='primary' size='large' onClick={handleTheClickOfThisButton}>Go</Button>;\n",
        expected:
            'const a = (\n    <Button\n        variant="primary"\n        size="large"\n        onClick={handleTheClickOfThisButton}>\n        Go\n    </Button>\n);\n',
    },
    {
        name: "operatorLinebreak",
        file: "a.ts",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            lineWidth: 80,
            javascript: { operatorLinebreak: "before" },
        },
        input: "const valid = isEnabled && hasPermission(user) && !isBlocked(user) && withinLimits(request);\n",
        expected:
            "const valid =\n    isEnabled\n    && hasPermission(user)\n    && !isBlocked(user)\n    && withinLimits(request);\n",
    },
    {
        name: "JSON",
        file: "a.json",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: '{"name":"a","list":[1,2,3],"nested":{\n"b":true}}\n',
        expected:
            '{\n    "name": "a",\n    "list": [1, 2, 3],\n    "nested": {\n        "b": true\n    }\n}\n',
    },
    {
        name: "package.json expands",
        file: "package.json",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: '{"name":"a","keywords":["b","c"]}\n',
        expected:
            '{\n    "name": "a",\n    "keywords": [\n        "b",\n        "c"\n    ]\n}\n',
    },
    {
        name: "sequences in return and throw keep parentheses",
        file: "a.ts",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "function f() { return a, b; }\nfunction g() { throw a, b; }\n",
        expected:
            "function f() {\n    return (a, b);\n}\nfunction g() {\n    throw (a, b);\n}\n",
    },
    {
        name: "tuple types keep a trailing comma after rest elements",
        file: "a.ts",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "type B = [aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb, ...string[]];\n",
        expected:
            "type B = [\n    aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,\n    bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb,\n    ...string[],\n];\n",
    },
    {
        name: "conditional types on generic types move after =",
        file: "a.ts",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "type P2<Code extends string> = Foo<Code> extends string ? aaaaaaaaaaaaaaaaaaaa : bbbbbbbbbbbbbbbbbbbbbbbb;\ntype Q5<Code> = Code extends Foo<X> ? aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa : bbbbbbbbbbbbbbbbbbbbbbbb;\n",
        expected:
            "type P2<Code extends string> =\n    Foo<Code> extends string ? aaaaaaaaaaaaaaaaaaaa : bbbbbbbbbbbbbbbbbbbbbbbb;\ntype Q5<Code> =\n    Code extends Foo<X>\n        ? aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n        : bbbbbbbbbbbbbbbbbbbbbbbb;\n",
    },
    {
        name: "other conditional types stay beside = while their head fits",
        file: "a.ts",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "type P3<Code extends string> = Code extends string ? aaaaaaaaaaaaaaaaaaaaaaaaaaaaa : bbbbbbbbbbbbbbbbbbbbbbbb;\ntype Single<Code extends string> = Code extends `${Value}${infer Rest extends string}aaaaaa` ? [Value, Rest] : [];\n",
        expected:
            "type P3<Code extends string> = Code extends string\n    ? aaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n    : bbbbbbbbbbbbbbbbbbbbbbbb;\ntype Single<Code extends string> =\n    Code extends `${Value}${infer Rest extends string}aaaaaa`\n        ? [Value, Rest]\n        : [];\n",
    },
    {
        name: "complex type parameters break before a conditional type",
        file: "a.ts",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "type P5<Value extends string, Codeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee extends string> = Code extends string ? [Valueeeeeeeeeeeeeeeeeeeee, Resttttttttttttttttttt] : [];\n",
        expected:
            "type P5<\n    Value extends string,\n    Codeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee extends string,\n> = Code extends string\n    ? [Valueeeeeeeeeeeeeeeeeeeee, Resttttttttttttttttttt]\n    : [];\n",
    },
    {
        name: "arrow chains indent a block body with their signatures, predicates break parameters",
        file: "a.ts",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "class A {\n    readonly hook = (kind: HookKind) => (body: Body, timeout?: number): void => { this.#open(kind); this.#current.hooks[kind].push({ body, timeout }); };\n    static asymmetric(value: unknown): value is { asymmetricMatch(other: unknown): boolean } { return true; }\n}\n",
        expected:
            "class A {\n    readonly hook =\n        (kind: HookKind) =>\n        (body: Body, timeout?: number): void => {\n            this.#open(kind);\n            this.#current.hooks[kind].push({ body, timeout });\n        };\n    static asymmetric(\n        value: unknown,\n    ): value is { asymmetricMatch(other: unknown): boolean } {\n        return true;\n    }\n}\n",
    },
    {
        name: "instantiation expressions keep the parentheses that TypeScript needs to parse them",
        file: "a.ts",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "(make<T>) + y;\n(make<T>) - y;\n(make<T>) < y;\n(make<T>) > y;\n(make<T>) >= y;\n(make<T>) >> y;\n(make<T>) >>> y;\n(make<T>) * y;\n(make<T>) === y;\n(c + a<T>) - b;\n(typeof a<T>) + b;\n(<X>a<T>) + b;\nx = (a<T>)!;\nx = (a<T>)<U>;\nclass A extends (B<T>)<U> {}\nclass C extends (B<T>) {}\nx = (a + b)<T>;\nx = (a || b)<T>;\nx = (a as B)<T>;\nx = (<B>a)<T>;\nx = (a<T>).b;\n",
        expected:
            "(make<T>) + y;\n(make<T>) - y;\n(make<T>) < y;\n(make<T>) > y;\n(make<T>) >= y;\n(make<T>) >> y;\n(make<T>) >>> y;\nmake<T> * y;\nmake<T> === y;\nc + (a<T>) - b;\ntypeof (a<T>) + b;\n<X>(a<T>) + b;\nx = (a<T>)!;\nx = (a<T>)<U>;\nclass A extends (B<T>)<U> {}\nclass C extends B<T> {}\nx = (a + b)<T>;\nx = (a || b)<T>;\nx = (a as B)<T>;\nx = (<B>a)<T>;\nx = (a<T>).b;\n",
    },
    {
        name: "arrow functions returning as expressions are not hugged",
        file: "a.ts",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "const items = open.children.map((item) => this.block(item, definitions) as ListItem & Block);\nconst b = list.map((item) => ({ a: 1, b: 2, c: 3, d: 4, eeeeeeeeeeeeeeeeeeeeeeeeeeeee: 5 }) as Thing);\nfoo((x) => x as unknown as Something<VeryLongTypeArgument, AnotherLongTypeArgument>);\n",
        expected:
            "const items = open.children.map(\n    (item) => this.block(item, definitions) as ListItem & Block,\n);\nconst b = list.map(\n    (item) =>\n        ({ a: 1, b: 2, c: 3, d: 4, eeeeeeeeeeeeeeeeeeeeeeeeeeeee: 5 }) as Thing,\n);\nfoo(\n    (x) =>\n        x as unknown as Something<\n            VeryLongTypeArgument,\n            AnotherLongTypeArgument\n        >,\n);\n",
    },
    {
        name: "new keeps the parentheses around a callee that contains import()",
        file: "a.ts",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: 'new (import("x").Foo)();\nnew (import("x")).Foo();\n',
        expected: 'new (import("x").Foo)();\nnew (import("x").Foo)();\n',
    },
    {
        name: "headings use # markers and are followed by a blank line",
        file: "a.md",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "# Heading with trailing hashes ##\n   ### indented\nSetext  with  spaces\n===\n\nMulti line\nsetext\n---\n# trailing one \n#  two  \n#\n",
        expected:
            "# Heading with trailing hashes\n\n### indented\n\n# Setext with spaces\n\nMulti line\nsetext\n---\n\n# trailing one \n\n# two\n\n#\n",
    },
    {
        name: "paragraphs keep their lines and hard breaks, collapse spaces",
        file: "a.md",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "para one   with   spaces\n   indented  continuation\ntrailing   \nbackslash\\\nend\n",
        expected:
            "para one with spaces\nindented continuation\ntrailing  \nbackslash\\\nend\n",
    },
    {
        name: "markers alternate between sibling lists, numbers follow the first ones",
        file: "a.md",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "* star\n* another\n+ plus\n1) paren\n2) two\n\n3. three\n4. four\n\n9. a\n10. b\n\n1. a\n1. b\n1. c\n",
        expected:
            "- star\n- another\n\n* plus\n\n1. paren\n2. two\n\n3) three\n4) four\n\n5) a\n6) b\n\n7) a\n8) b\n9) c\n",
    },
    {
        name: "list items keep the spaces after their marker and align their lines",
        file: "a.md",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "-   wide\n-  b\n- c\n    continuation\n- [X] task\n- [ ] open\n- \n",
        expected:
            "-   wide\n-  b\n- c\n  continuation\n- [x] task\n- [ ] open\n-\n",
    },
    {
        name: "list items keep one blank line, put them around fences, none before nested lists",
        file: "a.md",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "- a\n\n\n  para\n- b\n  ```\n  x\n  ```\n  after\n- c\n\n  - nested\n",
        expected:
            "- a\n\n  para\n- b\n\n  ```\n  x\n  ```\n\n  after\n- c\n  - nested\n",
    },
    {
        name: "thematic breaks become --- with blank lines around them",
        file: "a.md",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "***\npara\n___\n- - -\n* * *\n",
        expected: "---\n\npara\n\n---\n\n---\n\n---\n",
    },
    {
        name: "italics use _ unless next to words, bold uses **",
        file: "a.md",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "Some *emph* and __strong__ and ***both*** and _under_ a*b*c and [*ref*][r]\n\n***whole paragraph***\n\n[r]: /url\n",
        expected:
            "Some _emph_ and **strong** and **_both_** and _under_ a*b*c and [*ref*][r]\n\n_**whole paragraph**_\n\n[r]: /url\n",
    },
    {
        name: "code spans use the shortest fence and drop the spaces CommonMark strips",
        file: "a.md",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "```request.body``` and `` `tick` `` and ``  a  `` and `a\n  b`\n",
        expected: "`request.body` and `` `tick` `` and `  a  ` and `a\n  b`\n",
    },
    {
        name: "fenced code uses backticks, trimmed info strings and closing fences",
        file: "a.md",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "~~~python  \nprint( 1 )\n~~~\n\n````md\n```\nx\n```\n````\n\n```\nunclosed\n",
        expected:
            "```python\nprint( 1 )\n```\n\n````md\n```\nx\n```\n````\n\n```\nunclosed\n```\n",
    },
    {
        name: "code in JavaScript, TypeScript, JSON and Markdown is formatted, other code stays",
        file: "a.md",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: '```js\nconst a = {b:1}\n```\n\n```ts\nlet x:number=1\n```\n\n```json\n{"a":[1,2]}\n```\n\n```md\n* a\n```\n\n```js\nconst a = <div />\n```\n\n```sh\nls  -la\n```\n\n```js\nconst = ;\n```\n\n- ```js\n  const b = {c:1}\n  ```\n',
        expected:
            '```js\nconst a = { b: 1 };\n```\n\n```ts\nlet x: number = 1;\n```\n\n```json\n{ "a": [1, 2] }\n```\n\n```md\n- a\n```\n\n```js\nconst a = <div />\n```\n\n```sh\nls  -la\n```\n\n```js\nconst = ;\n```\n\n- ```js\n  const b = {c:1}\n  ```\n',
    },
    {
        name: "tables are aligned by the display width of their cells",
        file: "a.md",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "| Left | Center | Right |\n|:-----|:------:|------:|\n| a | b | c |\n| longer text | ✅ | 3 |\n",
        expected:
            "| Left        | Center | Right |\n| :---------- | :----: | ----: |\n| a           |   b    |     c |\n| longer text |   ✅   |     3 |\n",
    },
    {
        name: "quotes keep their lines, and get markers on lazy lines",
        file: "a.md",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "> quote\ncontinued lazily\n>\n> > nested\n\n>a\n>  b\n\n> para\n> ```js\n> x\n> ```\n",
        expected:
            "> quote\n> continued lazily\n>\n> > nested\n\n> a\n>  b\n\n> para\n>\n> ```js\n> x\n> ```\n",
    },
    {
        name: "links, autolinks, images and definitions are normalized",
        file: "a.md",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "[link]( http://example.com  \"title\" ) [b](u 'single')\n[ref]: http://example.com  'Title'\n  [a]: http://x\n\n\n[b]: http://y\n\n<http://auto.link> ![image](src.png)\n",
        expected:
            '[link](http://example.com "title") [b](u "single")\n[ref]: http://example.com \'Title\'\n[a]: http://x\n\n[b]: http://y\n\n<http://auto.link> ![image](src.png)\n',
    },
    {
        name: "lines inside links and code keep their indentation",
        file: "a.md",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "see [the\n  docs](http://x) now\n- item [with\n    link](x) and `code\n  span`\n",
        expected:
            "see [the\n  docs](http://x) now\n\n- item [with\n    link](x) and `code\n  span`\n",
    },
    {
        name: "blank lines between blocks collapse into one, except after comments",
        file: "a.md",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "# A\n\n\n\nb\n\n\n\nc\n\n\n- list\n\n\n\npara\n\n\n<!-- c -->\n\n\n\n---\n",
        expected: "# A\n\nb\n\nc\n\n- list\n\npara\n\n<!-- c -->\n\n\n\n---\n",
    },
    {
        name: "one blank line before a list after quotes, tables and html blocks",
        file: "a.md",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "> A note.\n\n- one\n- two\n\n| T |\n| - |\n| V |\n\n\n- Hello\n\n<div>\nx\n</div>\n\n- a\n\n> q\n- b\n",
        expected:
            "> A note.\n\n- one\n- two\n\n| T   |\n| --- |\n| V   |\n\n- Hello\n\n<div>\nx\n</div>\n\n- a\n\n> q\n- b\n",
    },
    {
        name: "html blocks and comments stay as written",
        file: "a.md",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: '<div align="center">\n<img src="x.png"   width="100">\n</div>\n\n<!-- a comment -->\n\n\n\npara <span   a="b">x</span>\n',
        expected:
            '<div align="center">\n<img src="x.png"   width="100">\n</div>\n\n<!-- a comment -->\n\n\n\npara <span   a="b">x</span>\n',
    },
    {
        name: "lazy lines that start with a list marker are joined",
        file: "a.md",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "  1. A string.  Conditional\n  expressions may take:\n    * For string values\n",
        expected:
            "1. A string. Conditional\n   expressions may take: * For string values\n",
    },
    {
        name: "proseWrap always wraps paragraphs and long definitions",
        file: "a.md",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            lineWidth: 80,
            markdown: { proseWrap: "always" },
        },
        input: 'A paragraph with many words that goes on and on past the line width of eighty columns, with a [link that has spaces](http://example.com) inside.\nShort line.  \nAfter a break.\n\n- an item with a long text that also needs to be wrapped because it is too long to fit\n\n[definition]: https://example.com/a/very/long/path/that/does/not/fit/on/one/line/at/all "title"\n',
        expected:
            'A paragraph with many words that goes on and on past the line width of eighty\ncolumns, with a [link that has spaces](http://example.com) inside. Short line.  \nAfter a break.\n\n- an item with a long text that also needs to be wrapped because it is too long\n  to fit\n\n[definition]:\n    https://example.com/a/very/long/path/that/does/not/fit/on/one/line/at/all\n    "title"\n',
    },
    {
        name: "proseWrap never joins the lines of paragraphs",
        file: "a.md",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            lineWidth: 80,
            markdown: { proseWrap: "never" },
        },
        input: "one\ntwo\nthree  \nfour\n\n> quoted\n> lines\n\n| a | b |\n| - | - |\n| a cell that is quite long, longer than the line | and another long cell beside it |\n",
        expected:
            "one two three  \nfour\n\n> quoted lines\n\n| a | b |\n| --- | --- |\n| a cell that is quite long, longer than the line | and another long cell beside it |\n",
    },
    {
        name: "html: inline elements fill lines and hug their tags when they break",
        file: "a.html",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            lineWidth: 80,
            html: { enabled: true },
        },
        input: '<p>Some <b>bold</b>, <i>italic</i>, <a href="#">a link</a>, <code>code</code>, and <em>emphasis</em> in a paragraph that is long enough to wrap around the line width.</p>\n<button type="button" class="btn btn-primary btn-lg" onclick="doSomething()" disabled>Click me please</button>\n',
        expected:
            '<p>\n    Some <b>bold</b>, <i>italic</i>, <a href="#">a link</a>, <code>code</code>,\n    and <em>emphasis</em> in a paragraph that is long enough to wrap around the\n    line width.\n</p>\n<button\n    type="button"\n    class="btn btn-primary btn-lg"\n    onclick="doSomething()"\n    disabled\n>\n    Click me please\n</button>\n',
    },
    {
        name: "html: blocks break, blank lines stay, lists and tables break their children",
        file: "a.html",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            lineWidth: 80,
            html: { enabled: true },
        },
        input: "<ul>\n  <li>One</li>\n\n\n  <li>Two <span>nested <b>deep</b></span></li>\n</ul>\n<p>\n  text<br>more text<br/>\n  end\n</p>\n<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>\n<select><option>a</option><option selected>b</option></select>\n<dl><dt>t</dt><dd>d</dd></dl>\n",
        expected:
            "<ul>\n    <li>One</li>\n\n    <li>\n        Two <span>nested <b>deep</b></span>\n    </li>\n</ul>\n<p>\n    text<br>more text<br>\n    end\n</p>\n<table>\n    <thead>\n        <tr>\n            <th>A</th>\n            <th>B</th>\n        </tr>\n    </thead>\n    <tbody>\n        <tr>\n            <td>1</td>\n            <td>2</td>\n        </tr>\n    </tbody>\n</table>\n<select>\n    <option>a</option>\n    <option selected>b</option>\n</select>\n<dl>\n    <dt>t</dt>\n    <dd>d</dd>\n</dl>\n",
    },
    {
        name: "html: scripts are formatted as JavaScript, import maps as JSON, other types stay",
        file: "a.html",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            lineWidth: 80,
            html: { enabled: true },
        },
        input: '<div>\n<script type="application/ld+json">{"a":1}</script>\n<script type="importmap">{"imports":{"a":"./a.js","b":"./b.js"}}</script>\n<script type="text/babel">let a=<b/></script>\n<script>\n\n  let x  = 1\n\n</script>\n<script></script>\n<script>   </script>\n<script type="module">import a from "a";const t=`\n  keep\n`</script>\n</div>\n',
        expected:
            '<div>\n    <script type="application/ld+json">{"a":1}</script>\n    <script type="importmap">\n    { "imports": { "a": "./a.js", "b": "./b.js" } }\n    </script>\n    <script type="text/babel">let a=<b/></script>\n    <script>\n    let x = 1;\n    </script>\n    <script></script>\n    <script>\n    </script>\n    <script type="module">\n    import a from "a";\n    const t = `\n  keep\n`;\n    </script>\n</div>\n',
    },
    {
        name: "html: doctypes are normalized, comments keep their lines",
        file: "a.html",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            lineWidth: 80,
            html: { enabled: true },
        },
        input: "<!-- a -->\n\n<!-- b -->\n<!doctype html>\n<!-- c --><html><head><title>T</title></head></html>\n<!-- end1 -->\n\n<!-- end2 -->\n",
        expected:
            "<!-- a -->\n\n<!-- b -->\n<!doctype html>\n<!-- c -->\n<html>\n    <head>\n        <title>T</title>\n    </head>\n</html>\n<!-- end1 -->\n\n<!-- end2 -->\n",
    },
    {
        name: "html: old doctypes keep their identifiers",
        file: "a.html",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            lineWidth: 80,
            html: { enabled: true },
        },
        input: '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">\n<html><body><p>x</p></body></html>\n',
        expected:
            '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">\n<html>\n    <body>\n        <p>x</p>\n    </body>\n</html>\n',
    },
    {
        name: "html: attribute values get double quotes unless single ones escape less",
        file: "a.html",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            lineWidth: 80,
            html: { enabled: true },
        },
        input: '<div\n  class="a"\n\n  id=b>text</div>\n<input value=\'he said "hi"\'>\n<input value="it&apos;s">\n<a href=x title=\'a\'>y</a>\n',
        expected:
            '<div class="a" id="b">text</div>\n<input value=\'he said "hi"\'>\n<input value="it\'s">\n<a href="x" title="a">y</a>\n',
    },
    {
        name: "html: srcset candidates and iframe allow break into lines",
        file: "a.html",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            lineWidth: 80,
            html: { enabled: true },
        },
        input: '<img srcset="a.jpg 1x, b.jpg 2x, very-long-image-name-here.jpg 3x" src="a.jpg" alt="x"><img srcset="small.jpg 480w, medium-size-image.jpg 800w, large.jpg 1200w" sizes="(max-width: 600px) 480px, 800px" src="x.jpg" alt="y">\n<iframe allow="camera; microphone; geolocation; fullscreen; picture-in-picture; autoplay" src="x"></iframe>\n',
        expected:
            '<img\n    srcset="a.jpg 1x, b.jpg 2x, very-long-image-name-here.jpg 3x"\n    src="a.jpg"\n    alt="x"\n><img\n    srcset="small.jpg 480w, medium-size-image.jpg 800w, large.jpg 1200w"\n    sizes="(max-width: 600px) 480px, 800px"\n    src="x.jpg"\n    alt="y"\n>\n<iframe\n    allow="\n        camera;\n        microphone;\n        geolocation;\n        fullscreen;\n        picture-in-picture;\n        autoplay;\n    "\n    src="x"\n></iframe>\n',
    },
    {
        name: "html: tag and attribute names of HTML elements are lower-cased",
        file: "a.html",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            lineWidth: 80,
            html: { enabled: true },
        },
        input: '<DIV CLASS=a ID=b DATA-X=1><SPAN TabIndex=0>x</SPAN><my-El FooBar=1></my-El><svg viewBox="0 0 1 1"><foreignObject></foreignObject></svg></DIV>\n',
        expected:
            '<div class="a" id="b" DATA-X="1">\n    <span tabindex="0">x</span><my-El FooBar="1"></my-El\n    ><svg viewBox="0 0 1 1"><foreignObject></foreignObject></svg>\n</div>\n',
    },
    {
        name: "html: custom elements are inline, SVG and MathML elements blocks",
        file: "a.html",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            lineWidth: 80,
            html: { enabled: true },
        },
        input: '<custom-element some-attr="1"><nested-thing>x</nested-thing></custom-element>\n<svg width="10" height="10"><circle cx="5" cy="5" r="4"/><path d="M0 0L10 10"/></svg>\n<math><mi>x</mi><mo>=</mo><mn>1</mn></math>\n',
        expected:
            '<custom-element some-attr="1"><nested-thing>x</nested-thing></custom-element>\n<svg width="10" height="10">\n    <circle cx="5" cy="5" r="4" />\n    <path d="M0 0L10 10" />\n</svg>\n<math>\n    <mi>x</mi>\n    <mo>=</mo>\n    <mn>1</mn>\n</math>\n',
    },
    {
        name: "html: line breaks between CJK characters are kept",
        file: "a.html",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            lineWidth: 80,
            html: { enabled: true },
        },
        input: "<p>中文文本\n继续中文。English text\nmore</p>\n<p>日本語の文章、\nつづき</p>\n",
        expected:
            "<p>\n    中文文本\n    继续中文。English text more\n</p>\n<p>\n    日本語の文章、\n    つづき\n</p>\n",
    },
    {
        name: "html: details, media and templates",
        file: "a.html",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            lineWidth: 80,
            html: { enabled: true },
        },
        input: '<details><summary>Sum</summary>Details text here</details>\n<video controls><source src="a.mp4"><track kind="captions"></video>\n<template><div>t</div></template>\n',
        expected:
            '<details>\n    <summary>Sum</summary>\n    Details text here\n</details>\n<video controls>\n    <source src="a.mp4">\n    <track kind="captions">\n</video>\n<template>\n    <div>t</div>\n</template>\n',
    },
    {
        name: "html: text at the root fills lines",
        file: "a.html",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            lineWidth: 80,
            html: { enabled: true },
        },
        input: "just text at the root, quite long, long enough that it should wrap at eighty columns for sure\n",
        expected:
            "just text at the root, quite long, long enough that it should wrap at eighty\ncolumns for sure\n",
    },
    {
        name: "html: biome-ignore format keeps the next node as written",
        file: "a.html",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            lineWidth: 80,
            html: { enabled: true },
        },
        input: "<!-- biome-ignore format: don't break this -->\n<div>This is some really long content that should be broken on multiple lines. However, it won't because there is a suppression comment. This is the desired behavior.</div>\n<div>\n<!-- biome-ignore format: kept -->\n<span>one     two</span><!-- trailing -->\n<p>a    b</p>\n</div>\n123<!--biome-ignore format: kept-->4      56\n",
        expected:
            "<!-- biome-ignore format: don't break this -->\n<div>This is some really long content that should be broken on multiple lines. However, it won't because there is a suppression comment. This is the desired behavior.</div>\n<div>\n    <!-- biome-ignore format: kept -->\n    <span>one     two</span><!-- trailing -->\n    <p>a b</p>\n</div>\n123<!--biome-ignore format: kept-->4      56\n",
    },
    {
        name: "html: biome-ignore-all format keeps the file as written",
        file: "a.html",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            lineWidth: 80,
            html: { enabled: true },
        },
        input: "<!-- biome-ignore-all format: generated -->\n<div>   code   </div>\n",
        expected:
            "<!-- biome-ignore-all format: generated -->\n<div>   code   </div>\n",
    },
    {
        name: "html: whitespaceSensitivity strict hugs every tag",
        file: "a.html",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            lineWidth: 80,
            html: { enabled: true, whitespaceSensitivity: "strict" },
        },
        input: '<p>Some <b>bold</b>, <i>italic</i>, <a href="#">a link</a>, <code>code</code>, and <em>emphasis</em> in a paragraph that is long enough to wrap around the line width.</p>\n<button type="button" class="btn btn-primary btn-lg" onclick="doSomething()" disabled>Click me please</button>\n<div> a </div>\n',
        expected:
            '<p\n    >Some <b>bold</b>, <i>italic</i>, <a href="#">a link</a>, <code>code</code>,\n    and <em>emphasis</em> in a paragraph that is long enough to wrap around the\n    line width.</p\n>\n<button\n    type="button"\n    class="btn btn-primary btn-lg"\n    onclick="doSomething()"\n    disabled\n    >Click me please</button\n>\n<div> a </div>\n',
    },
    {
        name: "html: whitespaceSensitivity ignore lets content move off tags",
        file: "a.html",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            lineWidth: 80,
            html: { enabled: true, whitespaceSensitivity: "ignore" },
        },
        input: '<p>Some <b>bold</b>, <i>italic</i>, <a href="#">a link</a>, <code>code</code>, and <em>emphasis</em> in a paragraph that is long enough to wrap around the line width.</p>\n<button type="button" class="btn btn-primary btn-lg" onclick="doSomething()" disabled>Click me please</button>\n<span> a </span>\n',
        expected:
            '<p>\n    Some<b>bold</b>,<i>italic</i>,<a href="#">a link</a>,<code>code</code>, and<em\n    >\n        emphasis\n    </em> in a paragraph that is long enough to wrap around the line width.\n</p>\n<button\n    type="button"\n    class="btn btn-primary btn-lg"\n    onclick="doSomething()"\n    disabled\n>\n    Click me please\n</button>\n<span>a</span>\n',
    },
    {
        name: "html: selfCloseVoidElements always self-closes void elements",
        file: "a.html",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            lineWidth: 80,
            html: { enabled: true, selfCloseVoidElements: "always" },
        },
        input: '<br><img src=a.png alt=""><input type=text name=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa value=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb><div/>\n',
        expected:
            '<br /><img src="a.png" alt="" />\n<input\n    type="text"\n    name="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"\n    value="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"\n/>\n<div />\n',
    },
    {
        name: "html: bracketSameLine keeps > after the last attribute",
        file: "a.html",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            lineWidth: 80,
            html: { enabled: true, bracketSameLine: true },
        },
        input: '<button type="submit" class="btn btn-primary btn-large" id="submit-button-with-long-id">Submit</button>\n<img src="aaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png" alt="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" />\n<div/>\n',
        expected:
            '<button\n    type="submit"\n    class="btn btn-primary btn-large"\n    id="submit-button-with-long-id">\n    Submit\n</button>\n<img\n    src="aaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png"\n    alt="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb">\n<div />\n',
    },
    {
        name: "html: attributePosition multiline puts each attribute on a line",
        file: "a.html",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            lineWidth: 80,
            html: { enabled: true, attributePosition: "multiline" },
        },
        input: '<a href="#" class="x">y</a>\n<b id="one">z</b>\n',
        expected:
            '<a\n    href="#"\n    class="x"\n    >y</a\n>\n<b id="one">z</b>\n',
    },
    {
        name: "html: processing instructions break their attributes",
        file: "a.html",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            lineWidth: 80,
            html: { enabled: true },
        },
        input: '<?xml version="1.0" encoding="UTF-8" standalone="yes" something-long="to-break"?>\n<root></root>\n',
        expected:
            '<?xml\n    version="1.0"\n    encoding="UTF-8"\n    standalone="yes"\n    something-long="to-break" ?>\n<root></root>\n',
    },
    {
        name: "html: preformatted elements stay as written",
        file: "a.html",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            lineWidth: 80,
            html: { enabled: true },
        },
        input: "<pre>\n  keep   this\n    exactly\n</pre>\n<textarea>\n  a  \n</textarea>\n<div><pre>x</pre></div>\n",
        expected:
            "<pre>\n  keep   this\n    exactly\n</pre>\n<textarea>\n  a  \n</textarea>\n<div><pre>x</pre></div>\n",
    },
    {
        name: "html: indentScriptAndStyle indents scripts",
        file: "a.html",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            lineWidth: 80,
            html: { enabled: true, indentScriptAndStyle: true },
        },
        input: "<head>\n<script>let  a=1</script>\n<style></style>\n</head>\n",
        expected:
            "<head>\n    <script>\n        let a = 1;\n    </script>\n    <style></style>\n</head>\n",
    },
    {
        name: "css: declarations are lower-cased and normalized, values keep their case",
        file: "a.css",
        rules: { indentStyle: "space", indentWidth: 4 },
        input: "A{COLOR:RED;Background:#FFF;margin:-0.50PX +.5em 1.0E3px 0010.0px;content:'a\"b'}\n",
        expected:
            "A {\n    color: RED;\n    background: #fff;\n    margin: -0.5px +0.5em 1e3px 0010px;\n    content: 'a\"b';\n}\n",
    },
    {
        name: "css: selector lists break, combinators and pseudo classes are spaced",
        file: "a.css",
        rules: { indentStyle: "space", indentWidth: 4 },
        input: "A:HOVER::BEFORE,DIV#Id.Cls[HREF=x i],a:NOT(.b,.c)>B~C+D{}\n.a:nth-child( 2n+1 ){color:red}\n",
        expected:
            'A:hover::before,\nDIV#Id.Cls[HREF="x" i],\na:not(.b, .c) > B ~ C + D {\n}\n.a:nth-child(2n + 1) {\n    color: red;\n}\n',
    },
    {
        name: "css: comma separated values with several parts get one line each",
        file: "a.css",
        rules: { indentStyle: "space", indentWidth: 4 },
        input: "a{transition:opacity .3s ease,transform .3s ease;will-change:transform,opacity;font:12px/30px Arial,sans-serif}\n",
        expected:
            "a {\n    transition:\n        opacity 0.3s ease,\n        transform 0.3s ease;\n    will-change: transform, opacity;\n    font:\n        12px / 30px Arial,\n        sans-serif;\n}\n",
    },
    {
        name: "css: long values fill lines and functions break their arguments",
        file: "a.css",
        rules: { indentStyle: "space", indentWidth: 4 },
        input: 'a{font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial;mask-image: linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%), url(aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png);width: calc(100% - var(--sidebar-width-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa) - var(--gutter-bbbbbbbbbbbbbb))}\n',
        expected:
            'a {\n    font-family:\n        ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",\n        Roboto, "Helvetica Neue", Arial;\n    mask-image:\n        linear-gradient(\n            to right,\n            transparent 0%,\n            black 10%,\n            black 90%,\n            transparent 100%\n        ),\n        url(aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png);\n    width: calc(\n        100% -\n        var(--sidebar-width-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa) -\n        var(--gutter-bbbbbbbbbbbbbb)\n    );\n}\n',
    },
    {
        name: "css: at-rule preludes are spaced like their queries",
        file: "a.css",
        rules: { indentStyle: "space", indentWidth: 4 },
        input: '@MEDIA SCREEN AND (MAX-WIDTH:100PX) , PRINT{a{b:c}}\n@import url("foo.css") screen and (orientation:landscape);\n@supports (display:grid) and (not (display:inline-grid)){a{b:c}}\n@layer a,b;\n@charset "utf-8";\n',
        expected:
            '@media SCREEN AND (max-width: 100px), PRINT {\n    a {\n        b: c;\n    }\n}\n@import url("foo.css") screen and (orientation: landscape);\n@supports (display: grid) and (not (display: inline-grid)) {\n    a {\n        b: c;\n    }\n}\n@layer a, b;\n@charset "utf-8";\n',
    },
    {
        name: "css: keyframes, font faces and nested rules",
        file: "a.css",
        rules: { indentStyle: "space", indentWidth: 4 },
        input: '@keyframes FOO{FROM{a:b}50%{a:c}TO{a:d}}\n@font-face{font-family:"Foo";src:url(a.woff2)format("woff2"),url(a.woff) format("woff")}\n.a{color:red;&:hover{color:blue}>.b{margin:0}}\n',
        expected:
            '@keyframes FOO {\n    from {\n        a: b;\n    }\n    50% {\n        a: c;\n    }\n    to {\n        a: d;\n    }\n}\n@font-face {\n    font-family: "Foo";\n    src:\n        url(a.woff2) format("woff2"),\n        url(a.woff) format("woff");\n}\n.a {\n    color: red;\n    &:hover {\n        color: blue;\n    }\n    > .b {\n        margin: 0;\n    }\n}\n',
    },
    {
        name: "css: comments and blank lines stay, empty declarations go",
        file: "a.css",
        rules: { indentStyle: "space", indentWidth: 4 },
        input: "/* header */\n\n\na { /* inside */\n  color: red; /* trailing */\n  ;;\n\n\n  margin: 0;\n}\n\n/* footer */\n",
        expected:
            "/* header */\n\na {\n    /* inside */\n    color: red; /* trailing */\n\n    margin: 0;\n}\n\n/* footer */\n",
    },
    {
        name: "css: custom properties keep their values",
        file: "a.css",
        rules: { indentStyle: "space", indentWidth: 4 },
        input: "a{--Foo:a  b,c;--empty:;--n: .5PX;w:var(--a,)}\n",
        expected:
            "a {\n    --Foo: a b, c;\n    --empty: ;\n    --n: 0.5px;\n    w: var(--a,);\n}\n",
    },
    {
        name: "css: quotes follow the quote style, @charset keeps its quotes",
        file: "a.css",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            css: { quoteStyle: "single" },
        },
        input: '@charset "utf-8";\na{content:"a";b:"it\'s"}\n[a="b"]{}\n',
        expected:
            "@charset \"utf-8\";\na {\n    content: 'a';\n    b: \"it's\";\n}\n[a='b'] {\n}\n",
    },
    {
        name: "css: biome-ignore keeps a rule as written",
        file: "a.css",
        rules: { indentStyle: "space", indentWidth: 4 },
        input: "/* biome-ignore format: keep */\na  {  color :  red }\nb  {  color :  red }\n",
        expected:
            "/* biome-ignore format: keep */\na  {  color :  red }\nb {\n    color: red;\n}\n",
    },
    {
        name: "blocks that interrupt a paragraph get a blank line, HTML blocks do not",
        file: "a.md",
        rules: { indentStyle: "space", indentWidth: 4 },
        input: "para\n# heading\npara\n```\ncode\n```\npara\n- item\n\npara\n> quote\n\npara\n<div>x</div>\n",
        expected:
            "para\n\n# heading\n\npara\n\n```\ncode\n```\npara\n\n- item\n\npara\n\n> quote\n\npara\n<div>x</div>\n",
    },
    {
        name: "consecutive blank lines collapse into one, no blank line after a definition before a list",
        file: "a.md",
        rules: { indentStyle: "space", indentWidth: 4 },
        input: "a\n\n\n\nb\n\n\n- list\n\n\n\npara\n\n\n\n    code\n\n\n\n[a]: b\n\n\n- c\n",
        expected: "a\n\nb\n\n- list\n\npara\n\n    code\n\n[a]: b\n- c\n",
    },
    {
        name: "emphasis wraps like the text around it",
        file: "a.md",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            markdown: { proseWrap: "always" },
        },
        input: "a *very long emphasized text that goes over the line width of eighty characters for sure* b\nsome **strong\ntext** and ~~strike\nthrough~~\n",
        expected:
            "a _very long emphasized text that goes over the line width of eighty characters\nfor sure_ b some **strong text** and ~~strike through~~\n",
    },
    {
        name: "emphasis joins its lines like the text around it",
        file: "a.md",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            markdown: { proseWrap: "never" },
        },
        input: "some **strong\ntext** and _em\nphasis_ and ~~strike\nthrough~~\n",
        expected:
            "some **strong text** and _em phasis_ and ~~strike through~~\n",
    },
    {
        name: "parentheses that end an optional chain stay before a non-null assertion",
        file: "a.ts",
        rules: { indentStyle: "space", indentWidth: 4 },
        input: "(a?.b)!.c;\n(a?.b)!();\nnew (a?.b)!();\n((a?.b)!).c;\n(a?.b)?.c;\n(a?.b).c = 1;\n(a?.b)`t`;\nf((a?.[0])!.b);\n",
        expected:
            "(a?.b)!.c;\n(a?.b)!();\nnew (a?.b)!();\n(a?.b)!.c;\na?.b?.c;\n(a?.b).c = 1;\n(a?.b)`t`;\nf((a?.[0])!.b);\n",
    },
    {
        name: "quotes keep the indentation before their markers, unless a paragraph continues in them",
        file: "a.md",
        rules: { indentStyle: "space", indentWidth: 4 },
        input: "  > q\n\n  > a\n  >\n  > - b\n  > - c\n\n  > d\n  > e\n\n > f\n>  g\n\n  > h  \n  i\n\n> j\n  k\n",
        expected:
            "  > q\n\n  > a\n  >\n  > - b\n> - c\n\n> d\n> e\n\n > f\n>  g\n\n  > h  \ni\n\n> j k\n",
    },
    {
        name: "wrapped prose puts inlines of several lines on lines of their own, and joins code spans",
        file: "a.md",
        rules: {
            indentStyle: "space",
            indentWidth: 4,
            markdown: { proseWrap: "always" },
        },
        input: "aa [b\nc](u) d *e  \nf* g `h\n  i` j\n\n[*em in\nlink*](u) z\n",
        expected:
            "aa\n[b\nc](u)\nd\n_e  \nf_\ng `h   i` j\n\n[*em in\nlink*](u)\nz\n",
    },
    {
        name: "the parameters of arrows break with their return type, those of function types do not",
        file: "a.ts",
        rules: { indentStyle: "space", indentWidth: 4 },
        input: "const f = (a: string): {\n    b: 1;\n} => x;\nconst g = async (a: string): Promise<{\n    b: 1;\n}> => x;\ntype F = (a: string) => {\n    b: 1;\n};\nfoo((a: string): {\n    b: 1;\n} => x);\n",
        expected:
            "const f = (\n    a: string,\n): {\n    b: 1;\n} => x;\nconst g = async (\n    a: string,\n): Promise<{\n    b: 1;\n}> => x;\ntype F = (a: string) => {\n    b: 1;\n};\nfoo(\n    (\n        a: string,\n    ): {\n        b: 1;\n    } => x,\n);\n",
    },
    {
        name: "generic arrows keep the space after the equals sign",
        file: "a.ts",
        rules: { indentStyle: "space", indentWidth: 4 },
        input: "const f = <T,>(a: T) => a;\nconst g = <T,>(a: T) => (b: T) => a;\n",
        expected:
            "const f = <T>(a: T) => a;\nconst g =\n    <T>(a: T) =>\n    (b: T) =>\n        a;\n",
    },
];

describe("formatero", () => {
    describe("prints like Biome", () => {
        test.each(biome)("$name", ({ file, rules, input, expected }) => {
            expect(format(input, file, rules)).toBe(expected);
            expect(format(expected, file, rules)).toBe(expected);
        });
    });

    describe("layout", () => {
        const layout = (doc: Parameters<Layout["print"]>[0], lineWidth = 20) =>
            new Layout({ lineWidth, useTabs: false, indentWidth: 4 }).print(
                doc,
            );
        const list = group([
            "[",
            indent([softline, "aaaaa,", line, "bbbbb,", line, "ccccc"]),
            softline,
            "]",
        ]);

        test("groups stay flat when they fit, break when not", () => {
            expect(layout(list, 40)).toBe("[aaaaa, bbbbb, ccccc]");
            expect(layout(list, 10)).toBe(
                "[\n    aaaaa,\n    bbbbb,\n    ccccc\n]",
            );
        });

        test("ifBreak, conditional groups and fill", () => {
            expect(
                layout(group(["a", ifBreak("broken", "flat"), softline]), 10),
            ).toBe("aflat");
            expect(
                layout(
                    conditionalGroup([
                        "too long for the line",
                        group(["short", hardline, "x"]),
                    ]),
                ),
            ).toBe("short\nx");
            expect(layout(fill(["aaaa", line, "bbbb", line, "cccc"]), 10)).toBe(
                "aaaa bbbb\ncccc",
            );
        });

        test("line suffixes wait for the end of the line", () => {
            expect(layout(["a", lineSuffix(" // c"), "b", hardline, "d"])).toBe(
                "ab // c\nd",
            );
        });
    });

    describe("errors", () => {
        test("syntax errors are reported, or formatted by tokens with formatWithErrors", () => {
            expect(() => format("const = ;\n")).toThrow(FormatError);
            expect(() => format("a;\nconst = ;\n")).toThrow(/^2:7 /);
            expect(
                format("let  a =  'b'\nconst = ;\n", "a.ts", {
                    formatWithErrors: true,
                }),
            ).toBe('let  a =  "b";\nconst = ;\n');
        });

        test("HTML must close its elements, like Biome", () => {
            const html = { html: { enabled: true } };
            expect(() => format("<div><span></div>\n", "a.html", html)).toThrow(
                "1:12 Expected a matching closing tag but instead found '</div>'.",
            );
            expect(() => format("<p>a\n", "a.html", html)).toThrow(
                "2:1 Expected a closing tag but instead found the end of the file.",
            );
            expect(() => format("<p>a < b</p>\n", "a.html", html)).toThrow(
                /^1:6 Unescaped `<`/,
            );
            expect(() => format("<br></br>\n", "a.html", html)).toThrow(
                /^1:5 Void elements should not have a closing tag/,
            );
            expect(() =>
                format("---\na: 1\n---\n<p></p>\n", "a.html", html),
            ).toThrow(/Frontmatter is only valid inside Astro files/);
            // errors in scripts are at their place in the file
            expect(() =>
                format("<p></p>\n<script>const = 1</script>\n", "a.html", html),
            ).toThrow(/^2:15 /);
        });
    });

    describe("files", () => {
        test("enabled turns formatting off, for all or one language", () => {
            const messy = "let  a =  1\n";
            expect(format(messy, "a.ts", { enabled: false })).toBe(messy);
            expect(
                format(messy, "a.ts", { javascript: { enabled: false } }),
            ).toBe(messy);
            expect(
                format('{"a":1}', "a.json", { json: { enabled: false } }),
            ).toBe('{"a":1}');
            expect(format(messy, "a.ts", { json: { enabled: false } })).toBe(
                "let a = 1;\n",
            );
            expect(
                format("* a\n", "a.md", { markdown: { enabled: false } }),
            ).toBe("* a\n");
            expect(format("* a\n", "README.markdown")).toBe("- a\n");
        });

        test("CSS fences in Markdown are formatted", () => {
            expect(format("```css\na{color:red}\n```\n", "a.md")).toBe(
                "```css\na {\n    color: red;\n}\n```\n",
            );
        });

        test("CSS is formatted unless disabled, errors stop it like Biome", () => {
            expect(format("a{color:red}\n", "a.css")).toBe(
                "a {\n    color: red;\n}\n",
            );
            expect(
                format("a{color:red}\n", "a.CSS", { css: { enabled: false } }),
            ).toBe("a{color:red}\n");
            expect(() => format("a{color:red\n", "a.css")).toThrow(FormatError);
            expect(() =>
                format("<style>a{color:red</style>\n", "a.html", {
                    html: { enabled: true },
                }),
            ).toThrow(FormatError);
        });

        test("formatero-ignore and biome-ignore suppress formatting alike", () => {
            const html = { html: { enabled: true } };
            for (const prefix of ["formatero", "biome"]) {
                expect(
                    format(
                        `<!-- ${prefix}-ignore format: kept -->\n<DIV>x</DIV>\n<DIV>y</DIV>\n`,
                        "a.html",
                        html,
                    ),
                ).toBe(
                    `<!-- ${prefix}-ignore format: kept -->\n<DIV>x</DIV>\n<div>y</div>\n`,
                );
                const file = `<!-- ${prefix}-ignore-all format: kept -->\n<DIV>x</DIV>\n`;
                expect(format(file, "a.html", html)).toBe(file);
                expect(
                    format(
                        `/* ${prefix}-ignore format: kept */\na{color:red}\nb{color:red}\n`,
                        "a.css",
                    ),
                ).toBe(
                    `/* ${prefix}-ignore format: kept */\na{color:red}\nb {\n    color: red;\n}\n`,
                );
                const sheet = `/* ${prefix}-ignore-all format: kept */\na{color:red}\n`;
                expect(format(sheet, "a.css")).toBe(sheet);
            }
        });

        test("HTML is formatted when enabled, .htm too, styles as CSS", () => {
            const messy = "<DIV>x</DIV>\n";
            expect(format(messy, "a.html")).toBe(messy);
            expect(format(messy, "a.html", { html: { enabled: true } })).toBe(
                "<div>x</div>\n",
            );
            expect(format(messy, "a.HTM", { html: { enabled: true } })).toBe(
                "<div>x</div>\n",
            );
            // styles are formatted as CSS at the level of the element
            expect(
                format("<style>\na{color:red}\n</style>\n", "a.html", {
                    html: { enabled: true },
                }),
            ).toBe("<style>\na {\n    color: red;\n}\n</style>\n");
            // HTML ends with a newline unless HTML says otherwise
            expect(
                format("<p></p>", "a.html", {
                    trailingNewline: false,
                    html: { enabled: true },
                }),
            ).toBe("<p></p>\n");
            expect(
                format("<p></p>", "a.html", {
                    html: { enabled: true, trailingNewline: false },
                }),
            ).toBe("<p></p>");
        });

        test("Markdown formats html fences when HTML is enabled", () => {
            const source = "```html\n<DIV   class=x>x</DIV>\n```\n";
            expect(format(source, "a.md")).toBe(source);
            expect(format(source, "a.md", { html: { enabled: true } })).toBe(
                '```html\n<div class="x">x</div>\n```\n',
            );
        });

        test("Markdown formats the code of its fences, unless formatEmbeds is false", () => {
            const source = "* a\n\n```ts\nlet  a\n```\n";
            expect(format(source, "a.md")).toBe("- a\n\n```ts\nlet a;\n```\n");
            expect(
                format(source, "a.md", { markdown: { formatEmbeds: false } }),
            ).toBe("- a\n\n```ts\nlet  a\n```\n");
            expect(
                format(source, "a.md", { javascript: { enabled: false } }),
            ).toBe("- a\n\n```ts\nlet  a\n```\n");
            expect(
                format(source, "a.md", {
                    javascript: { lineEnding: "crlf", trailingNewline: true },
                }),
            ).toBe("- a\n\n```ts\nlet a;\n```\n");
            expect(
                format("```js\n#!/usr/bin/env node\nlet  a\n```\n", "a.md"),
            ).toBe("```js\n#!/usr/bin/env node\nlet  a\n```\n");
        });

        test("includes selects files in order, the last match decides", () => {
            const formatero = new Formatero(
                Config.merge(defaults.rules, {
                    includes: ["src/**", "!src/generated"],
                }),
            );
            expect(formatero.formats("src/a.ts")).toBe(true);
            expect(formatero.formats("src/generated/a.ts")).toBe(false);
            expect(formatero.formats("tests/a.ts")).toBe(false);
            expect(formatero.format("let  a\n", "tests/a.ts")).toBe("let  a\n");
        });

        test("shared rules apply to every language unless it overrides them", () => {
            expect(
                format("const { a } = b;\n", "a.ts", { bracketSpacing: false }),
            ).toBe("const {a} = b;\n");
            expect(
                format("const { a } = b;\n", "a.ts", {
                    bracketSpacing: false,
                    javascript: { bracketSpacing: true },
                }),
            ).toBe("const { a } = b;\n");
        });
    });

    describe("editorconfig", () => {
        const editorconfig = new EditorConfig(
            [
                "root = true",
                "",
                "[*]",
                "indent_style = space",
                "indent_size = 2",
                "end_of_line = crlf",
                "insert_final_newline = false",
                "",
                "# Makefiles need tabs",
                "[{Makefile,*.mk}]",
                "indent_style = tab",
                "indent_size = tab",
                "tab_width = 8",
            ].join("\n"),
        );

        test("reads indentation, line endings and final newlines", () => {
            expect(editorconfig.rules("src/a.ts")).toEqual({
                indentStyle: "space",
                indentWidth: 2,
                lineEnding: "crlf",
                trailingNewline: false,
            });
        });

        test("section globs match like Biome's", () => {
            const matches = (glob: string, file: string) =>
                new EditorConfig(`[${glob}]\nindent_size = 7\n`).rules(file)
                    .indentWidth === 7;
            // a bracket expression in braces, and nested braces
            expect(matches("{[ab],c}.json", "a.json")).toBe(true);
            expect(matches("{[ab],c}.json", "b.json")).toBe(true);
            expect(matches("{[ab],c}.json", "c.json")).toBe(true);
            expect(matches("{[ab],c}.json", "d.json")).toBe(false);
            expect(matches("{*.{js,json},biome.jsonc}", "a.json")).toBe(true);
            expect(matches("{*.{js,json},biome.jsonc}", "biome.jsonc")).toBe(
                true,
            );
            expect(matches("{*.{js,json},biome.jsonc}", "a.ts")).toBe(false);
            // a single unmatched brace makes every brace literal
            expect(matches("{a,b}}.json", "{a,b}}.json")).toBe(true);
            expect(matches("{a,b}}.json", "a}.json")).toBe(false);
            expect(matches("{a,{b,c}", "a")).toBe(false);
            // braces without a comma are literal, numeric ranges are not
            expect(matches("{a}.js", "{a}.js")).toBe(true);
            expect(matches("{a}.js", "a.js")).toBe(false);
            expect(matches("{1..3}.js", "2.js")).toBe(true);
            expect(matches("{1..3}.js", "4.js")).toBe(false);
            // `*` and `?` stay in a folder, globs with `/` start at the root
            expect(matches("a?c.js", "a/c.js")).toBe(false);
            expect(matches("[!ab].js", "c.js")).toBe(true);
            expect(matches("src/*.js", "src/a.js")).toBe(true);
            expect(matches("src/*.js", "src/x/a.js")).toBe(false);
            expect(matches("src/*.js", "x/src/a.js")).toBe(false);
            expect(matches("src/**/*.js", "src/x/a.js")).toBe(true);
            expect(matches("/root.js", "root.js")).toBe(true);
            expect(matches("/root.js", "x/root.js")).toBe(false);
            expect(matches("\\*.js", "a.js")).toBe(false);
        });

        test("later sections win, braces list alternatives", () => {
            expect(editorconfig.rules("Makefile")).toMatchObject({
                indentStyle: "tab",
                indentWidth: 8,
            });
            expect(editorconfig.rules("build/rules.mk")).toMatchObject({
                indentStyle: "tab",
            });
        });
    });

    describe("lines", () => {
        test("lineEnding and trailingNewline", () => {
            expect(
                format("a();\nb();\n\n\n", "a.ts", { lineEnding: "crlf" }),
            ).toBe("a();\r\nb();\r\n");
            expect(format("a();\n", "a.ts", { trailingNewline: false })).toBe(
                "a();",
            );
        });

        test("Markdown has the line endings and final newline of its rules", () => {
            expect(
                format("# a\r\n\r\nb", "a.md", {
                    markdown: { lineEnding: "crlf", trailingNewline: false },
                }),
            ).toBe("# a\r\n\r\nb");
            expect(format("\uFEFF# a\n", "a.md")).toBe("\uFEFF# a\n");
        });

        test("text files are reindented line by line, a tab is one level", () => {
            expect(format("a:\n  b:\n\t\tc\n", "a.yml")).toBe(
                "a:\n    b:\n        c\n",
            );
        });
    });

    describe("regressions", () => {
        /** Formats, and checks that formatting the output changes nothing. */
        const stable = (source: string, file = "a.ts", rules: object = {}) => {
            const once = format(source, file, rules);
            expect(format(once, file, rules)).toBe(once);
            return once;
        };

        test("line comments in empty brackets get lines of their own, not hiding the bracket", () => {
            expect(stable("const f = ( // C\n) => 1;\n")).toBe(
                "const f = (\n    // C\n) => 1;\n",
            );
            expect(stable("function g( // C\n) {}\n")).toBe(
                "function g(\n    // C\n) {}\n",
            );
            expect(stable("class A {\n    m( // C\n    ) {}\n}\n")).toBe(
                "class A {\n    m(\n        // C\n    ) {}\n}\n",
            );
            expect(stable("x = <div>{ // C\n}</div>;\n", "a.tsx")).toBe(
                "x = (\n    <div>\n        {\n            // C\n        }\n    </div>\n);\n",
            );
            // block comments stay inline
            expect(stable("const f = (/* C */) => 1;\n")).toBe(
                "const f = (/* C */) => 1;\n",
            );
            expect(stable("x = <div>{/* C */}</div>;\n", "a.tsx")).toBe(
                "x = <div>{/* C */}</div>;\n",
            );
        });

        test("comments before the semicolon of break and continue are kept", () => {
            expect(
                stable(
                    "for (;;) {\n    continue /* C */;\n    break /* D */;\n}\n",
                ),
            ).toBe(
                "for (;;) {\n    continue /* C */;\n    break /* D */;\n}\n",
            );
            expect(
                stable("a: for (;;) {\n    continue a // C\n    ;\n}\n"),
            ).toBe("a: for (;;) {\n    continue a; // C\n}\n");
        });

        test("a comment that would be lost in an HTML script fails the file, not the run", () => {
            const html = { html: { enabled: true } };
            expect(() =>
                format(
                    "<script>\nfunction f() { return new /* C */.target; }\n</script>\n",
                    "a.html",
                    html,
                ),
            ).toThrow(FormatError);
            const log: string[] = [];
            const saved: string[] = [];
            const passed = formatFiles(
                [
                    { file: "a.js", path: "/a.js", text: "let  a\n" },
                    { file: "b.js", path: "/b.js", text: "b\n" },
                    { file: "c.js", path: "/c.js", text: "let  c\n" },
                ],
                (text, file) => {
                    if (file === "b.js") throw new TypeError("a bug");
                    return format(text, file);
                },
                {
                    write: true,
                    log: (line) => log.push(line),
                    save: (path) => saved.push(path),
                },
            );
            expect(passed).toBe(false);
            expect(saved).toEqual(["/a.js", "/c.js"]);
            expect(log[0]).toBe("formatted: a.js");
            expect(log[1]).toMatch(
                /^error: b\.js: formatero failed, please report it: TypeError: a bug/,
            );
            expect(log[2]).toBe("formatted: c.js");
        });

        test("Markdown lines that would start a block once unindented join the line before", () => {
            for (const proseWrap of ["preserve", "always"]) {
                const markdown = { markdown: { proseWrap } };
                const md = (source: string) => stable(source, "a.md", markdown);
                expect(md("Text:\n\t- a\n\t- b\n")).toBe("Text: - a - b\n");
                expect(md("Text\n    # not a heading\n")).toBe(
                    "Text # not a heading\n",
                );
                expect(md("Text\n    > not a quote\n")).toBe(
                    "Text > not a quote\n",
                );
                expect(md("Text\n    1. not a list\n")).toBe(
                    "Text 1. not a list\n",
                );
                expect(md("Text\n    ---\n")).toBe("Text ---\n");
            }
            // only 1 starts an ordered list that interrupts a paragraph
            expect(stable("Text\n2. stays a line\n", "a.md")).toBe(
                "Text\n2. stays a line\n",
            );
            // wrapping never starts a line with a list marker
            expect(
                stable("aaaaaaaaaa bbbbbbbb - cc dd\n", "a.md", {
                    lineWidth: 20,
                    markdown: { proseWrap: "always" },
                }),
            ).toBe("aaaaaaaaaa bbbbbbbb -\ncc dd\n");
        });

        test("comments in unions, module names and mapped types stay where they are", () => {
            expect(stable('type T =\n    | "a"\n    // B\n    | "b";\n')).toBe(
                'type T =\n    | "a"\n    // B\n    | "b";\n',
            );
            expect(stable('import {\n    a,\n    // b,\n} from "x";\n')).toBe(
                'import {\n    a,\n    // b,\n} from "x";\n',
            );
            expect(stable('import { // C\n} from "x";\n')).toBe(
                'import {\n    // C\n} from "x";\n',
            );
            expect(
                stable(
                    "type A = {\n    // before the key\n    [K in keyof T]:\n        // before the type\n        T[K];\n};\n",
                ),
            ).toBe(
                "type A = {\n    // before the key\n    [K in keyof T]: // before the type\n    T[K];\n};\n",
            );
            expect(stable("type B = { /* c */ [K in keyof T]: T[K] };\n")).toBe(
                "type B = { /* c */ [K in keyof T]: T[K] };\n",
            );
        });

        test("comments in parentheses that are not printed go where they print", () => {
            expect(
                stable(
                    "x = ((0x30/* 0 */ <= c) && (c <= 0x39/* 9 */)) || d;\n",
                ),
            ).toBe("x = (0x30 /* 0 */ <= c && c <= 0x39) /* 9 */ || d;\n");
            expect(stable("x = a && (( // empty\n b && c) || d);\n")).toBe(
                "x =\n    a && // empty\n    ((b && c) || d);\n",
            );
            // comments on lines of their own stay
            expect(
                stable(
                    "f = (p) => !(\n    /* start */\n    (a > b)\n    /* stop */\n);\n",
                ),
            ).toBe(
                "f = (p) =>\n    !(\n        /* start */\n        (a > b)\n        /* stop */\n    );\n",
            );
        });

        test("line comments before bodies, catch clauses and values move like Biome moves them", () => {
            expect(
                stable(
                    "interface A // C\n{\n    a: string;\n}\nfunction f(): number // D\n{\n    return 1;\n}\n",
                ),
            ).toBe(
                "interface A {\n    // C\n    a: string;\n}\nfunction f(): number {\n    // D\n    return 1;\n}\n",
            );
            expect(
                stable(
                    "interface VirtualFileSystem\n    extends // Synchronous API\n        Pick<A, B> {}\n",
                ),
            ).toBe(
                "interface VirtualFileSystem // Synchronous API\n    extends Pick<A, B> {}\n",
            );
            expect(
                stable("try {\n    a();\n} // C\ncatch {\n    b();\n}\n"),
            ).toBe("try {\n    a();\n} catch {\n    // C\n    b();\n}\n");
            expect(
                stable(
                    'const file = // C\n    long === "." ? "package.json" : `${root}/package.json/and/more/text/here`;\n',
                ),
            ).toBe(
                'const file =\n    // C\n    long === "." ? "package.json" : `${root}/package.json/and/more/text/here`;\n',
            );
        });
    });
});
