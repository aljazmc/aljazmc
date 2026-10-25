![Custom](https://img.shields.io/badge/project_status-mostly_working-green) ![Custom](https://img.shields.io/badge/breaking_changes-common-red) ![NPM Downloads](https://img.shields.io/npm/dm/%40aljazmc%2Flintero) ![GitHub package.json version](https://img.shields.io/github/package-json/v/aljazmc/aljazmc?filename=packages%2Flintero%2Fpackage.json&color=green) ![GitHub License](https://img.shields.io/github/license/aljazmc/aljazmc)

# lintero

A simple linter for JavaScript, TypeScript, JSX and JSON, with 226
rules compatible with [Biome](https://biomejs.dev)'s, and their automatic
fixes. Easy to understand, easy to customize and easy to extend.

## Install

```sh
npm install --save-dev @aljazmc/lintero
```

lintero needs Node.js 22.18 or later, or 24.2 or later.

## Usage

```sh
lintero                   # report problems, exit 1 if there are errors
lintero --write           # apply the safe fixes, then report what is left
lintero --write --unsafe  # apply the unsafe fixes too
lintero --config          # write the defaults to lintero.config.ts
lintero --config js       # or to lintero.config.js
```

Each problem is reported with its position, rule and message:

```text
warn: src/a.ts:3:8 lint/suspicious/noExplicitAny: Unexpected any. Specify a different type.
```

Safe fixes do not change what the code does. Unsafe fixes may, so review
them before you keep them.

## Configuration

lintero reads `lintero.config.ts` or `lintero.config.js` from the
current directory. Objects are merged deeply into the defaults, and
anything else, like `ignore`, replaces them:

```js
export default {
    ignore: [".git", "node_modules"],
    rules: {
        domains: { react: "all", test: "none" },
        style: "error",
        suspicious: {
            preset: "all",
            noDebugger: "off",
            noDoubleEquals: {
                level: "warn",
                fix: "none",
                options: { ignoreNull: false },
            },
        },
    },
};
```

`ignore` lists the files and folders that are never linted. The `rules`
are:

| Option | Default | What it does |
|---|---|---|
| `enabled` | `true` | Lints files at all. |
| `includes` | `["**"]` | Globs of the files to lint, in order. The last match decides, and `!` excludes. |
| `preset` | `"recommended"` | The rules that run: `"recommended"`, `"all"` or `"none"`. |
| `domains` | `{}` | Rules of frameworks and tools, see [Domains](#domains): `"recommended"`, `"all"` or `"none"` for each. |
| `a11y`, `complexity`, `correctness`, `performance`, `security`, `style`, `suspicious` | | The rules of a [group](#rules), see [Groups](#groups). |
| `javascript.enabled` | `true` | Lints JavaScript, TypeScript and JSX files. |
| `javascript.globals` | `[]` | Global names that exist, for the rules about undeclared names. |
| `javascript.jsxRuntime` | `"transparent"` | `"reactClassic"` for JSX that needs `React` in scope. |
| `json.enabled` | `true` | Lints JSON files. |

### Groups

A group is set to a level for all of its rules, like `style: "error"`, or
to an object with a `preset` for the group and a level or configuration
for each rule:

| Level | What it does |
|---|---|
| `"off"` | Turns the rule off. |
| `"on"` | Turns the rule on, with its own severity. |
| `"info"`, `"warn"`, `"error"` | Turns the rule on, with this severity. Only errors make lintero exit with 1. |

A rule configuration is an object with a `level`, a `fix` (`"none"`,
`"safe"` or `"unsafe"`, to change how `--write` treats its fixes) and the
rule's `options`. A level for a whole group leaves the rules of domains
to their domains.

### Domains

Some rules belong to a framework or a tool. Their domain is enabled, with
its recommended rules, when the `package.json` closest to a file depends
on it:

| Domain | Enabled when `package.json` depends on | Rules |
|---|---|---|
| `react` | `react` 16 or later | 12 |
| `next` | `next` 14 or later | 9 |
| `qwik` | `@builder.io/qwik` 1 or later, or `@qwik.dev/core` 2 or later | 8 |
| `vue` | `vue` 3 or later | 4 |
| `test` | `jest` 26, `vitest` 1, `mocha` 8 or `ava` 2, or later | 4 |
| `reactNative` | `react-native` 0.60 or later | 3 |
| `playwright` | `@playwright/test` 1 or later | 2 |
| `drizzle` | `drizzle-orm` 0.9 or later | 2 |
| `solid` | `solid` 1 or later | 1 |
| `turborepo` | `turbo` 1 or later | 1 |
| `project` | never, enable it in `domains` | 1 |

`project` rules, like `noPrivateImports`, read the files a module
imports, so they run only when enabled. `noUndeclaredEnvVars` reads
`turbo.json`.

### Suppressions

`lintero-ignore` comments suppress diagnostics. They name the categories
to suppress, followed by a reason:

```js
// lintero-ignore lint/suspicious/noDebugger: suppresses the line of the next token
// lintero-ignore-all lint/style: suppresses the whole file
// lintero-ignore-start lint: suppresses everything up to the matching lintero-ignore-end
```

lintero reports suppressions that suppress nothing, when they name rules
it implements. For other rules, it cannot tell.

## Rules

Every rule has a group, a severity and a fix: safe, unsafe or none.
Recommended rules run by default. The others run with
`preset: "all"`, or with their domain, named in the last column.

### a11y

Accessibility of JSX and HTML: elements, ARIA roles and attributes, and keyboard use. 36 rules:

| Rule | What it reports | Severity | Fix | Recommended |
|---|---|---|---|---|
| `noAccessKey` | Disallows `accessKey`, whose shortcuts clash with those of screen readers and browsers. | error | unsafe | yes |
| `noAmbiguousAnchorText` | Disallows link texts like "click here" or "read more", which say nothing out of context. | error |  | yes |
| `noAriaHiddenOnFocusable` | Disallows `aria-hidden="true"` on elements that can take keyboard focus. | error | unsafe | yes |
| `noAriaUnsupportedElements` | Disallows `role` and `aria-*` on elements that do not support them, like `meta` and `script`. | error | unsafe | yes |
| `noAutofocus` | Disallows `autoFocus`, which moves focus unexpectedly for keyboard and screen reader users. | error | unsafe | yes |
| `noDistractingElements` | Disallows distracting elements like `marquee` and `blink`. | error | unsafe | yes |
| `noHeaderScope` | Allows `scope` only on `th` elements. | error | unsafe | yes |
| `noInteractiveElementToNoninteractiveRole` | Disallows non-interactive roles on interactive elements, like `role="img"` on a `button`. | error | unsafe | yes |
| `noLabelWithoutControl` | Requires every `label` to have text and an associated form control. | error |  | yes |
| `noNoninteractiveElementToInteractiveRole` | Disallows interactive roles on non-interactive elements, like `role="button"` on an `li`. | error | unsafe | yes |
| `noNoninteractiveTabindex` | Disallows `tabIndex` on non-interactive elements, so they do not take focus. | error | unsafe | yes |
| `noPositiveTabindex` | Disallows a positive `tabIndex`, which breaks the natural tab order. | error | unsafe | yes |
| `noRedundantAlt` | Disallows words like "image", "photo" or "picture" in `alt` texts, screen readers announce them already. | error |  | yes |
| `noRedundantRoles` | Disallows roles an element has anyway, like `role="button"` on a `button`. | error | unsafe | yes |
| `noStaticElementInteractions` | Disallows event handlers like `onClick` on static elements like `div`, without a role. | error |  | yes |
| `noSvgWithoutTitle` | Requires a `title` element or an accessible label on every `svg`. | error |  | yes |
| `useAltText` | Requires a text alternative (`alt`, `aria-label` or `aria-labelledby`) on images, image inputs and areas. | error |  | yes |
| `useAnchorContent` | Requires links to have content that screen readers can announce. | error | unsafe | yes |
| `useAriaActivedescendantWithTabindex` | Requires elements with `aria-activedescendant` to be focusable with `tabIndex`. | error | unsafe | yes |
| `useAriaPropsForRole` | Requires the ARIA attributes a role needs, like `aria-checked` for `role="checkbox"`. | error |  | yes |
| `useAriaPropsSupportedByRole` | Disallows ARIA attributes the role of an element does not support. | error |  | yes |
| `useButtonType` | Requires an explicit `type` on `button` elements, which submit forms by default. | error |  | yes |
| `useFocusableInteractive` | Requires elements with interactive roles to be focusable. | error |  | yes |
| `useHeadingContent` | Requires headings to have content that screen readers can announce. | error |  | yes |
| `useHtmlLang` | Requires a `lang` attribute on the `html` element. | error |  | yes |
| `useIframeTitle` | Requires a `title` on `iframe` elements. | error |  | yes |
| `useKeyWithClickEvents` | Requires a keyboard handler, like `onKeyDown`, next to `onClick`. | error |  | yes |
| `useKeyWithMouseEvents` | Requires `onFocus` and `onBlur` next to `onMouseOver` and `onMouseOut`. | error |  | yes |
| `useMediaCaption` | Requires a captions `track` in `audio` and `video` elements. | error |  | yes |
| `useSemanticElements` | Prefers semantic elements to roles, like `button` to `role="button"`. | error |  | yes |
| `useValidAnchor` | Requires links to have a valid `href`, and buttons to be used for actions instead. | error |  | yes |
| `useValidAriaProps` | Disallows `aria-*` attributes that do not exist. | error | unsafe | yes |
| `useValidAriaRole` | Requires roles to be valid, non-abstract ARIA roles. | error | unsafe | yes |
| `useValidAriaValues` | Requires ARIA attributes to have values of the right type. | error |  | yes |
| `useValidAutocomplete` | Requires valid values for `autocomplete`. | error |  | yes |
| `useValidLang` | Requires a valid language code in `lang`. | error |  | yes |

### complexity

Code that can be simpler, with the same result. 34 rules:

| Rule | What it reports | Severity | Fix | Recommended |
|---|---|---|---|---|
| `noAdjacentSpacesInRegex` | Disallows several spaces in a row in regular expressions, `/ {3}/` shows how many. | warn | safe | yes |
| `noArguments` | Disallows `arguments`, rest parameters are real arrays. | warn |  | yes |
| `noBannedTypes` | Disallows the types `String`, `Number`, `Boolean`, `Function`, `Object` and `{}`. | warn | safe | yes |
| `noCommaOperator` | Disallows the comma operator, outside of `for` loop updates. | warn |  | yes |
| `noEmptyTypeParameters` | Disallows empty type parameter lists, like `interface A<> {}`. | warn |  | yes |
| `noExtraBooleanCast` | Disallows `!!` and `Boolean()` where a value is converted to a boolean anyway, like in `if`. | info | safe | yes |
| `noFlatMapIdentity` | Prefers `.flat()` to `.flatMap()` with a callback that returns its argument. | info | unsafe | yes |
| `noStaticOnlyClass` | Disallows classes with only static members, a module or an object does the same. | warn |  | yes |
| `noThisInStatic` | Disallows `this` and `super` in static methods, the class name is clearer. | warn | unsafe | yes |
| `noUselessCatch` | Disallows `catch` clauses that only rethrow the error. | info | unsafe | yes |
| `noUselessConstructor` | Disallows constructors that do nothing, or only pass their arguments to `super`. | info | unsafe | yes |
| `noUselessContinue` | Disallows `continue` where the loop would continue anyway. | info | safe | yes |
| `noUselessEmptyExport` | Disallows `export {}` in files that have other imports or exports. | info | safe | yes |
| `noUselessEscapeInRegex` | Disallows escapes in regular expressions that change nothing, like `\a`. | info | safe | yes |
| `noUselessFragments` | Disallows fragments with a single child, or none. | info | unsafe | yes |
| `noUselessLabel` | Disallows labels that `break` and `continue` do not need. | info | safe | yes |
| `noUselessLoneBlockStatements` | Disallows blocks that are not part of a statement and declare nothing. | info | safe | yes |
| `noUselessRename` | Disallows renaming to the same name, like `{ a as a }`. | info | safe | yes |
| `noUselessStringRaw` | Disallows `String.raw` on strings without escapes. | info |  | yes |
| `noUselessSwitchCase` | Disallows `case` clauses that fall through to `default`. | info | unsafe | yes |
| `noUselessTernary` | Disallows conditionals that only pick `true` or `false`, like `a ? true : false`. | info | unsafe | yes |
| `noUselessThisAlias` | Disallows aliases of `this`, like `const self = this`, where arrow functions keep it. | info | safe | yes |
| `noUselessTypeConstraint` | Disallows `extends any` and `extends unknown` on type parameters. | info | safe | yes |
| `noUselessUndefinedInitialization` | Disallows initializing variables to `undefined`. | info | safe | yes |
| `useArrowFunction` | Prefers arrow functions to function expressions that do not use `this`. | warn | safe | yes |
| `useDateNow` | Prefers `Date.now()` to `new Date().getTime()` and similar. | warn | unsafe | yes |
| `useFlatMap` | Prefers `.flatMap()` to `.map().flat()`. | info | safe | yes |
| `useIndexOf` | Prefers `indexOf` to `findIndex` with a callback that only compares the item. | info | unsafe | yes |
| `useLiteralKeys` | Prefers `a.b` and `{ b: 1 }` to `a["b"]` and `{ ["b"]: 1 }`. | info | unsafe | yes |
| `useMathMinMax` | Prefers `Math.min` and `Math.max` to conditionals that pick the smaller or larger value. | warn | unsafe | yes |
| `useNumericLiterals` | Prefers binary, octal and hexadecimal literals to `parseInt` with a radix. | warn | safe | yes |
| `useOptionalChain` | Prefers optional chaining to chains of `&&` checks, like `a && a.b`. | warn | unsafe | yes |
| `useRegexLiterals` | Prefers regular expression literals to `new RegExp` with literal strings. | warn | safe | yes |
| `useSimpleNumberKeys` | Prefers plain decimal numbers as object keys, to `0x1` or `1e3`. | warn | safe | yes |

### correctness

Code that is certainly wrong, or does not do what it seems to. 56 rules:

| Rule | What it reports | Severity | Fix | Recommended |
|---|---|---|---|---|
| `noChildrenProp` | Disallows passing children as the `children` prop, instead of nesting them. | error |  | `react` |
| `noComponentHookFactories` | Disallows defining components and hooks inside other functions. | error |  | `react` |
| `noConstAssign` | Disallows assigning to `const` variables. | error | unsafe | yes |
| `noConstantCondition` | Disallows conditions that are always true or always false. | error |  | yes |
| `noConstantMathMinMaxClamp` | Disallows `Math.min` and `Math.max` combinations that always give the same result. | error | unsafe | yes |
| `noConstructorReturn` | Disallows returning a value from a constructor. | error |  | yes |
| `noEmptyCharacterClassInRegex` | Disallows empty character classes in regular expressions, like `[]`, which match nothing. | error |  | yes |
| `noEmptyPattern` | Disallows empty destructuring patterns, like `const {} = a`. | error |  | yes |
| `noGlobalObjectCalls` | Disallows calling objects like `Math`, `JSON` and `Reflect` as functions. | error |  | yes |
| `noInnerDeclarations` | Requires `var` and function declarations at the root of their function or file. | error |  | yes |
| `noInvalidBuiltinInstantiation` | Requires `new` for builtins like `Map`, and disallows it for `Symbol` and `BigInt`. | error | unsafe | yes |
| `noInvalidConstructorSuper` | Requires `super()` in constructors of derived classes, and disallows it in others. | error |  | yes |
| `noInvalidUseBeforeDeclaration` | Disallows using variables and parameters before they are declared. | error |  | yes |
| `noJsxNamespace` | Disallows namespaced JSX names, like `<a:b>`, which React does not support. | error |  | `react` |
| `noNonoctalDecimalEscape` | Disallows the escapes `\8` and `\9` in strings. | error | safe | yes |
| `noPlaywrightMissingAwait` | Requires `await` on asynchronous Playwright calls, like `expect(...).toBeVisible()`. | error | unsafe | `playwright` |
| `noPrecisionLoss` | Disallows number literals that cannot be represented exactly, like `9007199254740993`. | error |  | yes |
| `noPrivateImports` | Disallows importing symbols marked `@private` or `@package` in JSDoc from outside their module or folder. | warn |  | `project` |
| `noQwikUseVisibleTask` | Disallows `useVisibleTask$`, which runs eagerly in the browser. | error |  | `qwik` |
| `noReactNativeRawText` | Requires text in React Native to be inside a `Text` component. | error |  | `reactNative` |
| `noRenderReturnValue` | Disallows using the return value of `ReactDOM.render()`. | error |  | `react` |
| `noSelfAssign` | Disallows assigning a variable or property to itself. | error |  | yes |
| `noSetterReturn` | Disallows returning a value from a setter. | error |  | yes |
| `noStringCaseMismatch` | Disallows comparing `toUpperCase()` or `toLowerCase()` with a string of the other case. | error | unsafe | yes |
| `noSwitchDeclarations` | Requires declarations in `case` clauses to be in a block, so other clauses cannot reach them. | error | safe | yes |
| `noUnreachableSuper` | Requires constructors to call `super()` exactly once before `this`, on every path. | error |  | yes |
| `noUnreachable` | Disallows code that can never run, like after `return`. | error |  | yes |
| `noUnsafeFinally` | Disallows `return`, `throw`, `break` and `continue` in `finally`. | error |  | yes |
| `noUnsafeOptionalChaining` | Disallows optional chains where `undefined` throws, like `(a?.b)()` or `new a?.b()`. | error |  | yes |
| `noUnusedFunctionParameters` | Disallows unused function parameters. | warn | unsafe | yes |
| `noUnusedImports` | Disallows unused imports. | warn | unsafe | yes |
| `noUnusedLabels` | Disallows unused labels. | warn | safe | yes |
| `noUnusedPrivateClassMembers` | Disallows unused private class members. | warn | unsafe | yes |
| `noUnusedVariables` | Disallows unused variables, functions and classes. | warn | unsafe | yes |
| `noVoidElementsWithChildren` | Disallows children on void elements, like `img` and `br`. | error | unsafe | yes |
| `noVoidTypeReturn` | Disallows returning a value from functions whose return type is `void`. | error |  | yes |
| `noVueDataObjectDeclaration` | Requires `data` in Vue components to be a function, not an object. | error | safe | `vue` |
| `noVueRefAsOperand` | Requires `.value` to read Vue refs in expressions. | error |  | `vue` |
| `noVueReservedProps` | Disallows props named after reserved Vue attributes, like `key` and `ref`. | error |  | `vue` |
| `useExhaustiveDependencies` | Requires hook dependency arrays to list exactly the values the hook uses. | error | unsafe | `react`, `next` |
| `useHookAtTopLevel` | Requires hooks to be called at the top level of components and hooks, never conditionally. | error |  | `react`, `next` |
| `useImageSize` | Requires `width` and `height` on `img` elements in Qwik, to prevent layout shifts. | error |  | `qwik` |
| `useInlineScriptId` | Requires an `id` on `next/script` components with inline content. | error |  | `next` |
| `useIsNan` | Requires `Number.isNaN()` to check for `NaN`, which equals nothing, not even itself. | error | unsafe | yes |
| `useJsxKeyInIterable` | Requires a `key` on JSX elements created in arrays and iterators. | error |  | `react`, `qwik` |
| `useParseIntRadix` | Requires a radix in `parseInt()`. | info | unsafe | yes |
| `usePlaywrightValidDescribeCallback` | Requires `test.describe` callbacks to be synchronous and take no parameters. | error |  | `playwright` |
| `useQwikClasslist` | Prefers Qwik's `class` with objects and arrays to `classnames`-like utilities. | error |  | `qwik` |
| `useQwikLoaderLocation` | Requires `routeLoader$` and `routeAction$` to be exported from route files. | error |  | `qwik` |
| `useQwikMethodUsage` | Requires Qwik hooks to be called only in `component$` and other hooks. | error |  | `qwik` |
| `useQwikValidLexicalScope` | Requires values captured by `$()` closures to be serializable. | error |  | `qwik` |
| `useReactAsyncServerFunction` | Requires functions with `"use server"` to be `async`. | error | unsafe | `react` |
| `useReactNativePlatformComponents` | Disallows mixing iOS and Android components in one file. | error |  | `reactNative` |
| `useValidForDirection` | Requires the update of a `for` loop to move its counter towards the end condition. | error |  | yes |
| `useValidTypeof` | Requires `typeof` to be compared with valid type names, like `"string"`. | error | unsafe | yes |
| `useYield` | Requires generator functions to `yield`. | error |  | yes |

### performance

Code that is slower or bigger than it needs to be. 6 rules:

| Rule | What it reports | Severity | Fix | Recommended |
|---|---|---|---|---|
| `noAccumulatingSpread` | Disallows spreading the accumulator in `reduce`, which copies it on every call. | warn |  | yes |
| `noDynamicNamespaceImportAccess` | Disallows dynamic access to namespace imports, like `ns[key]`, which defeats tree shaking. | warn |  | yes |
| `noImgElement` | Prefers `next/image` to `img` elements in Next.js. | warn |  | `next` |
| `noUnwantedPolyfillio` | Disallows Polyfill.io scripts, Next.js includes the polyfills already. | warn |  | `next` |
| `useDomNodeTextContent` | Prefers `textContent` to `innerText`, which forces a layout. | warn | unsafe | yes |
| `useGoogleFontPreconnect` | Requires `rel="preconnect"` on links to Google Fonts. | info | safe | `next` |

### security

Code that opens the way to attacks. 5 rules:

| Rule | What it reports | Severity | Fix | Recommended |
|---|---|---|---|---|
| `noBlankTarget` | Requires `rel="noopener"` or `rel="noreferrer"` on links with `target="_blank"`. | error | safe | yes |
| `noDangerouslySetInnerHtmlWithChildren` | Disallows `dangerouslySetInnerHTML` together with children. | error |  | `react` |
| `noDangerouslySetInnerHtml` | Disallows `dangerouslySetInnerHTML`, an easy way to cross-site scripting. | error |  | `react` |
| `noGlobalEval` | Disallows `eval()`. | error |  | yes |
| `noScriptUrl` | Disallows `javascript:` URLs. | error |  | yes |

### style

A consistent way to write the same thing. 12 rules:

| Rule | What it reports | Severity | Fix | Recommended |
|---|---|---|---|---|
| `noHeadElement` | Prefers `next/head` to `head` elements in Next.js pages. | warn |  | `next` |
| `noNonNullAssertion` | Disallows non-null assertions, like `a!.b`. | warn | unsafe | yes |
| `useArrayLiterals` | Prefers array literals to the `Array` constructor. | info | safe | yes |
| `useConst` | Prefers `const` to `let` for variables assigned only once. | warn | safe | yes |
| `useExponentiationOperator` | Prefers `**` to `Math.pow()`. | info | safe | yes |
| `useExportType` | Requires `export type` for exports that are only types. | warn | safe | yes |
| `useImportType` | Requires `import type` for imports used only as types. | warn | safe | yes |
| `useLiteralEnumMembers` | Requires enum members to be initialized with literals. | warn |  | yes |
| `useNodejsImportProtocol` | Requires the `node:` protocol for Node.js builtin modules, like `node:fs`. | info | unsafe | yes |
| `useShorthandFunctionType` | Prefers function types to interfaces and type literals with only a call signature. | info | safe | yes |
| `useTemplate` | Prefers template literals to string concatenation. | info | unsafe | yes |
| `useVueMultiWordComponentNames` | Requires Vue component names of several words, so they cannot clash with HTML elements. | info |  | `vue` |

### suspicious

Code that is likely a mistake. 77 rules:

| Rule | What it reports | Severity | Fix | Recommended |
|---|---|---|---|---|
| `noApproximativeNumericConstant` | Prefers constants like `Math.PI` to approximations like `3.14`. | warn | unsafe | yes |
| `noArrayIndexKey` | Disallows array indexes as `key`, which breaks when items move. | error |  | `react` |
| `noAssignInExpressions` | Disallows assignments in expressions, like `if (a = b)`. | error |  | yes |
| `noAsyncPromiseExecutor` | Disallows `async` executor functions in `new Promise()`. | error |  | yes |
| `noBiomeFirstException` | Requires `files.includes` in a Biome configuration to start with `**` before its exceptions. | error | safe | yes |
| `noCatchAssign` | Disallows assigning to the parameter of a `catch` clause. | warn |  | yes |
| `noClassAssign` | Disallows assigning to class declarations. | error |  | yes |
| `noCommentText` | Disallows text that looks like a comment in JSX, like `// note`, which is rendered. | error | unsafe | yes |
| `noCompareNegZero` | Disallows comparing with `-0`, `Object.is()` tells it apart. | error | safe | yes |
| `noConfusingLabels` | Allows labels only on loops. | warn |  | yes |
| `noConfusingVoidType` | Allows `void` only as a return type or type argument. | warn | unsafe | yes |
| `noConstEnum` | Disallows `const enum`, which isolated module compilers like esbuild cannot compile. | warn | safe | yes |
| `noControlCharactersInRegex` | Disallows control characters in regular expressions, like `\x0C`. | error |  | yes |
| `noDebugger` | Disallows `debugger` statements. | error | unsafe | yes |
| `noDocumentCookie` | Disallows assigning to `document.cookie`, prefer the Cookie Store API. | warn |  | yes |
| `noDocumentImportInPage` | Allows `next/document` only in `pages/_document`. | warn |  | `next` |
| `noDoubleEquals` | Requires `===` and `!==`, which do not coerce types. | error | unsafe | yes |
| `noDrizzleDeleteWithoutWhere` | Requires `.where()` on Drizzle `delete` queries, which otherwise delete every row. | error |  | `drizzle` |
| `noDrizzleUpdateWithoutWhere` | Requires `.where()` on Drizzle `update` queries, which otherwise update every row. | error |  | `drizzle` |
| `noDuplicateCase` | Disallows duplicate `case` labels. | error |  | yes |
| `noDuplicateClassMembers` | Disallows duplicate class member names. | error |  | yes |
| `noDuplicateElseIf` | Disallows conditions an earlier `else if` of the same chain already covers. | error |  | yes |
| `noDuplicateEnumValues` | Disallows duplicate enum member values. | warn |  | yes |
| `noDuplicateJsxProps` | Disallows duplicate JSX props. | error |  | yes |
| `noDuplicateObjectKeys` | Disallows duplicate keys in objects and JSON. | error | unsafe | yes |
| `noDuplicateParameters` | Disallows duplicate parameter names. | error |  | yes |
| `noDuplicateTestHooks` | Disallows several hooks of the same kind, like two `beforeEach`, in one block. | error |  | `test` |
| `noEmptyInterface` | Disallows empty interfaces, which accept almost anything. | error | safe | yes |
| `noExplicitAny` | Disallows the `any` type. | warn |  | yes |
| `noExportsInTest` | Disallows exports from test files. | error |  | `test` |
| `noExtraNonNullAssertion` | Disallows repeated or needless non-null assertions, like `a!!`. | warn | safe | yes |
| `noFallthroughSwitchClause` | Disallows `case` clauses that fall through to the next one. | error |  | yes |
| `noFocusedTests` | Disallows focused tests, like `test.only` and `fdescribe`, which skip the rest. | warn | unsafe | `test` |
| `noFunctionAssign` | Disallows assigning to function declarations. | error |  | yes |
| `noGlobalAssign` | Disallows assigning to builtin globals, like `window` or `Object`. | error |  | yes |
| `noGlobalIsFinite` | Prefers `Number.isFinite()` to the global `isFinite()`, which coerces its argument. | warn | unsafe | yes |
| `noGlobalIsNan` | Prefers `Number.isNaN()` to the global `isNaN()`, which coerces its argument. | warn | unsafe | yes |
| `noHeadImportInDocument` | Disallows `next/head` in `pages/_document`. | warn |  | `next` |
| `noIdenticalTestTitle` | Disallows tests and suites with the same title in one block. | warn |  | `test` |
| `noImplicitAnyLet` | Requires a type or a value on `let` and `var` declarations, which are `any` otherwise. | error |  | yes |
| `noImportAssign` | Disallows assigning to imports. | error |  | yes |
| `noIrregularWhitespace` | Disallows irregular whitespace, like non-breaking spaces, outside of strings. | warn |  | yes |
| `noLabelVar` | Disallows labels with the name of a variable. | error |  | yes |
| `noMisleadingCharacterClass` | Disallows characters made of several code points in character classes, like emoji. | error | safe | yes |
| `noMisleadingInstantiator` | Disallows `new` in interfaces and `constructor` in type literals, which do not declare constructors. | error |  | yes |
| `noMisrefactoredShorthandAssign` | Disallows `a += a + b`, which is likely meant to be `a += b`. | error | unsafe | yes |
| `noNonNullAssertedOptionalChain` | Disallows non-null assertions after optional chains, like `a?.b!`. | error |  | yes |
| `noOctalEscape` | Disallows octal escapes in strings, like `\251`. | warn | safe | yes |
| `noProto` | Disallows `__proto__`, prefer `Object.getPrototypeOf()` and `Object.setPrototypeOf()`. | warn |  | yes |
| `noPrototypeBuiltins` | Prefers `Object.hasOwn()` to calling `Object.prototype` methods on objects. | warn | safe | yes |
| `noQuickfixBiome` | Prefers `source.fixAll.biome` to the deprecated `quickfix.biome` in editor settings. | info | safe | yes |
| `noReactNativeDeepImports` | Disallows importing React Native internals, like `react-native/Libraries/...`. | error |  | `reactNative` |
| `noReactSpecificProps` | Prefers `class` and `for` to the React-specific `className` and `htmlFor` in Solid and Qwik. | warn | safe | `solid`, `qwik` |
| `noReactStringRefs` | Disallows string refs, which React deprecated. | warn |  | `react` |
| `noRedeclare` | Disallows declaring a variable, function or type twice in the same scope. | error |  | yes |
| `noRedundantUseStrict` | Disallows `"use strict"` in modules and classes, which are strict already. | warn | safe | yes |
| `noSelfCompare` | Disallows comparing an expression with itself. | error |  | yes |
| `noShadowRestrictedNames` | Disallows shadowing globals like `NaN`, `Infinity` and `undefined`. | error |  | yes |
| `noSparseArray` | Disallows holes in array literals, like `[1, , 2]`. | error | unsafe | yes |
| `noSuspiciousSemicolonInJsx` | Disallows semicolons in JSX text, likely left there by mistake. | warn |  | yes |
| `noTemplateCurlyInString` | Disallows `${}` placeholders in plain strings, which are not interpolated. | warn |  | yes |
| `noThenProperty` | Disallows `then` properties, which make objects look like promises. | error |  | yes |
| `noTsIgnore` | Prefers `@ts-expect-error` to `@ts-ignore`. | warn | safe | yes |
| `noUndeclaredEnvVars` | Requires environment variables to be listed in `turbo.json`. | warn |  | `turborepo` |
| `noUnsafeDeclarationMerging` | Disallows merging a class and an interface, which TypeScript does not check. | error |  | yes |
| `noUnsafeNegation` | Disallows negating the left side of `in` and `instanceof`, like `!a in b`. | error | unsafe | yes |
| `noUselessEscapeInString` | Disallows escapes in strings that change nothing, like `\a`. | warn | safe | yes |
| `noUselessRegexBackrefs` | Disallows backreferences in regular expressions that always match an empty string. | warn |  | yes |
| `noWith` | Disallows `with` statements. | error |  | yes |
| `useAdjacentOverloadSignatures` | Requires overload signatures of a function to be next to each other. | warn |  | yes |
| `useBiomeIgnoreFolder` | Prefers `!folder` to `!folder/**` to ignore folders in a Biome configuration. | warn | safe | yes |
| `useDefaultSwitchClauseLast` | Requires `default` to be the last clause of a `switch`. | warn |  | yes |
| `useGetterReturn` | Requires getters to return a value. | error |  | yes |
| `useGoogleFontDisplay` | Requires a `display` parameter in Google Fonts URLs. | warn |  | yes |
| `useIsArray` | Prefers `Array.isArray()` to `instanceof Array`. | warn | unsafe | yes |
| `useIterableCallbackReturn` | Requires callbacks of `map`, `filter` and similar to return a value, and of `forEach` not to. | error |  | yes |
| `useNamespaceKeyword` | Prefers `namespace` to the outdated `module` keyword for TypeScript namespaces. | error | safe | yes |
## How it works

```
source
├─> @aljazmc/syntax   parses it into a syntax tree
├─> src/analysis      finds scopes, references and control flow, and the rules that run
└─> src/rules         visit the tree in one traversal, reporting problems and fixes
```

- `@aljazmc/syntax` (`shared/syntax`) parses sources into syntax trees and walks them, and is shared with formatero.
- `@aljazmc/config` (`shared/config`) loads `lintero.config.ts`, finds the files and matches `includes`, and is shared with every package.
- `src/analysis/settings.ts` resolves presets, domains, groups and rules to the rules that run.
- `src/analysis/semantic.ts` finds scopes, bindings and references, and tells types from values.
- `src/analysis/flow.ts` works out how statements complete, for unreachable code, fallthrough and returns.
- `src/rules` has one file per rule, visiting the nodes it checks in a single traversal shared by all rules.
- `src/analysis/suppressions.ts` reads suppression comments, and reports unused and malformed ones, also those limited to instances like `useExhaustiveDependencies(a)`.
- `src/analysis/aria.ts` knows ARIA roles and attributes and the roles of elements, and `src/analysis/regex.ts` parses regular expression literals.
- `src/analysis/globals.ts`, `jsx.ts`, `nodes.ts`, `react.ts`, `tests.ts` and `vue.ts` are helpers the rules share: global names, JSX, nodes, and calls of React, test frameworks and Vue.

## License

MIT, see [LICENSE](LICENSE).
