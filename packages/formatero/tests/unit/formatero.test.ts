import Config from "@aljazmc/config";
import defaults from "../../src/config.ts";
import EditorConfig from "../../src/editorconfig.ts";
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

/** Inputs with the output Biome 2.6 gives for them, the printer must match it. */
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
            '[link](http://example.com "title") [b](u "single")\n[ref]: http://example.com \'Title\'\n[a]: http://x\n\n\n[b]: http://y\n\n<http://auto.link> ![image](src.png)\n',
    },
    {
        name: "lines inside links and code keep their indentation",
        file: "a.md",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "see [the\n  docs](http://x) now\n- item [with\n    link](x) and `code\n  span`\n",
        expected:
            "see [the\n  docs](http://x) now\n- item [with\n    link](x) and `code\n  span`\n",
    },
    {
        name: "blank lines between blocks stay, but one after headings and around breaks",
        file: "a.md",
        rules: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
        input: "# A\n\n\n\nb\n\n\n\nc\n\n\n- list\n\n\n\npara\n\n\n<!-- c -->\n\n\n\n---\n",
        expected:
            "# A\n\nb\n\n\n\nc\n\n\n- list\n\n\n\npara\n\n\n<!-- c -->\n\n\n\n---\n",
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
});
