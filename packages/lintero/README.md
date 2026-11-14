![Custom](https://img.shields.io/badge/project_status-mostly_working-green) ![Custom](https://img.shields.io/badge/breaking_changes-common-red) ![NPM Downloads](https://img.shields.io/npm/dm/%40aljazmc%2Flintero) ![GitHub package.json version](https://img.shields.io/github/package-json/v/aljazmc/aljazmc?filename=packages%2Flintero%2Fpackage.json&color=green) ![GitHub License](https://img.shields.io/github/license/aljazmc/aljazmc)

# > lintero

A simple, dependency-free linter for CSS, HTML, JavaScript, JSON, JSX,
Markdown and TypeScript, with 287 rules and automatic fixes. Easy to
understand, easy to customize and easy to extend. Biome 2.6.6 compatible.

## > Features

| Feature            | Description                                                                   |
| ------------------ | ----------------------------------------------------------------------------- |
| Assist             | Organizes imports and exports like Biome, checked and fixed like rules.       |
| Automatic fixes    | `--write` applies safe fixes, `--write --unsafe` also the unsafe ones.        |
| Domains            | Framework rules turn on when the closest `package.json` depends on them.      |
| Embedded languages | Scripts and styles in HTML are linted as files of their own language.         |
| Groups and presets | Rules in 8 groups, run by `recommended`, `all` or `none` presets.             |
| Languages          | CSS, HTML, JavaScript, JSON, JSX, Markdown and TypeScript.                    |
| Suppressions       | `lintero-ignore` comments per line, range or file, with unused ones reported. |

## > Install

```sh
npm install --save-dev @aljazmc/lintero
```

Requires Node.js 22.18+, 24.2+, 25 or 26.

## > Usage

| Command                    | Description                                         |
| -------------------------- | --------------------------------------------------- |
| `lintero`                  | Reports problems, exits with 1 if there are errors. |
| `lintero --config [js]`    | Writes the defaults to `lintero.config.ts` (`.js`). |
| `lintero --write`          | Applies the safe fixes, then reports what is left.  |
| `lintero --write --unsafe` | Applies the unsafe fixes too.                       |

```text
warn: src/a.ts:3:8 lint/suspicious/noExplicitAny: Unexpected any. Specify a different type.
```

Safe fixes keep what the code does. Unsafe fixes may change it, so review
them before keeping them.

## > Configuration

`lintero.config.ts` (or `.js`) in the current directory overrides the
defaults: objects are merged deeply, anything else, like `ignore`, is
replaced.

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

| Option                                  | Default         | Description                                                    |
| --------------------------------------- | --------------- | -------------------------------------------------------------- |
| `a11y`, `complexity`, …, `suspicious`   |                 | Level or configuration of a [rule group](#-rules).             |
| `assist.actions.source.organizeImports` | `"on"`          | Level or configuration of [organizing imports](#-assist).      |
| `assist.enabled`                        | `true`          | Runs the assist actions.                                       |
| `css.cssModules`                        |                 | Allows CSS Modules syntax, unset only in `.module.css` files.  |
| `css.enabled`                           | `true`          | Lints `.css` files and the styles of HTML files.               |
| `domains`                               | `{}`            | `"recommended"`, `"all"` or `"none"` per [domain](#-domains).  |
| `enabled`                               | `true`          | Lints files at all.                                            |
| `html.enabled`                          | `true`          | Lints `.html` and `.htm` files and their scripts.              |
| `includes`                              | `["**"]`        | Globs of files to lint, the last match decides, `!` excludes.  |
| `javascript.enabled`                    | `true`          | Lints JavaScript, JSX and TypeScript files.                    |
| `javascript.globals`                    | `[]`            | Global names that exist, for the rules about undeclared names. |
| `javascript.jsxRuntime`                 | `"transparent"` | `"reactClassic"` for JSX that needs `React` in scope.          |
| `json.enabled`                          | `true`          | Lints JSON files.                                              |
| `markdown.enabled`                      | `true`          | Lints `.md` and `.markdown` files.                             |
| `preset`                                | `"recommended"` | The rules that run: `"recommended"`, `"all"` or `"none"`.      |

### > Levels

A group takes a level for all its rules, like `style: "error"`, or an
object with a `preset` and a level or configuration per rule. A rule
configuration has a `level`, a `fix` (`"none"`, `"safe"` or `"unsafe"`)
and the rule's `options`.

| Level                         | Description                                               |
| ----------------------------- | --------------------------------------------------------- |
| `"info"`, `"warn"`, `"error"` | Turns the rule on with this severity, only errors exit 1. |
| `"off"`                       | Turns the rule off.                                       |
| `"on"`                        | Turns the rule on with its own severity.                  |

### > Domains

A domain's recommended rules turn on when the closest `package.json`
depends on its package.

| Domain        | Enabled by dependency                           | Rules |
| ------------- | ----------------------------------------------- | ----- |
| `drizzle`     | `drizzle-orm` 0.9+                              | 2     |
| `next`        | `next` 14+                                      | 10    |
| `playwright`  | `@playwright/test` 1+                           | 2     |
| `project`     | never, enable it in `domains`                   | 1     |
| `qwik`        | `@builder.io/qwik` 1+ or `@qwik.dev/core` 2+    | 8     |
| `react`       | `react` 16+                                     | 13    |
| `reactNative` | `react-native` 0.60+                            | 3     |
| `solid`       | `solid` 1+                                      | 1     |
| `test`        | `ava` 2+, `jest` 26+, `mocha` 8+ or `vitest` 1+ | 4     |
| `turborepo`   | `turbo` 1+                                      | 1     |
| `vue`         | `vue` 3+                                        | 4     |

### > Assist

`assist/source/organizeImports` sorts the imports and exports of
JavaScript and TypeScript modules like Biome's action of the same name.
An unorganized chunk is an error, and `--write` organizes it.

Chunks are runs of imports, or of exports with a source and `export { a }`.
Statements, a switch between imports and exports, bare imports like
`import "a"`, and comments followed by a blank line split them.

Within a chunk:

- Sources are sorted by kind: URLs, protocols like `node:`, packages,
  aliases like `#a` or `@/a`, then paths, nearest last.
- Each kind is in natural order, `A < a < a9 < a10 < B`.
- Statements of a source merge when one statement can say both.
- Names in braces and attributes are sorted.
- Comments directly above a statement move with it.

A blank line separates a chunk from statements before and after it.

| Option            | Default     | Values                         | Description                                       |
| ----------------- | ----------- | ------------------------------ | ------------------------------------------------- |
| `identifierOrder` | `"natural"` | `"lexicographic"`, `"natural"` | How names in braces and attributes are compared.  |
| `sortBareImports` | `false`     | boolean                        | Sorts `import "a"` with the others, not in place. |

```js
export default {
    rules: {
        assist: {
            actions: {
                source: {
                    organizeImports: {
                        level: "on",
                        options: { identifierOrder: "lexicographic" },
                    },
                },
            },
        },
    },
};
```

Biome's `groups` option is not supported.

When statements merge, Biome drops the comments of the second one, but lintero keeps them.

### > Suppressions

```js
// lintero-ignore lint/suspicious/noDebugger: suppresses the line of the next token
// lintero-ignore-all lint/style: suppresses the whole file
// lintero-ignore-start lint: suppresses everything up to lintero-ignore-end
```

Markdown and HTML use `<!-- lintero-ignore … -->`, CSS uses
`/* lintero-ignore … */`. A suppression before `<script>` or `<style>`
covers its content. Suppressions that suppress nothing are reported. `biome-ignore` is accepted
as a synonym of `lintero-ignore`.

## > Rules

Each rule has a group, a severity and a fix (safe, unsafe or none).
Recommended rules run by default, the others with `preset: "all"` or with
the domain named in the last column.

| Group                        | Description                                      | Rules |
| ---------------------------- | ------------------------------------------------ | ----- |
| [a11y](#-a11y)               | Accessibility of JSX and HTML.                   | 38    |
| [complexity](#-complexity)   | Code that can be simpler, with the same result.  | 36    |
| [correctness](#-correctness) | Code that is certainly wrong.                    | 70    |
| [nursery](#-nursery)         | New rules that may still change, off by default. | 23    |
| [performance](#-performance) | Code that is slower or bigger than needed.       | 7     |
| [security](#-security)       | Code that opens the way to attacks.              | 6     |
| [style](#-style)             | A consistent way to write the same thing.        | 17    |
| [suspicious](#-suspicious)   | Code that is likely a mistake.                   | 90    |

### > a11y

Accessibility of JSX and HTML: elements, ARIA roles and attributes, keyboard use. 38 rules.

| Rule                                       | Description                                                                               | Severity | Fix    | Recommended |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- | -------- | ------ | ----------- |
| `noAccessKey`                              | Disallows `accessKey`, whose shortcuts clash with those of screen readers and browsers.   | error    | unsafe | yes         |
| `noAmbiguousAnchorText`                    | Disallows link texts like "click here" or "read more", which say nothing out of context.  | error    | none   | yes         |
| `noAriaHiddenOnFocusable`                  | Disallows `aria-hidden="true"` on elements that can take keyboard focus.                  | error    | unsafe | yes         |
| `noAriaUnsupportedElements`                | Disallows `role` and `aria-*` on elements like `meta` and `script`.                       | error    | unsafe | yes         |
| `noAutofocus`                              | Disallows `autoFocus`, which moves focus unexpectedly.                                    | error    | unsafe | yes         |
| `noDistractingElements`                    | Disallows distracting elements like `marquee` and `blink`.                                | error    | unsafe | yes         |
| `noHeaderScope`                            | Allows `scope` only on `th` elements.                                                     | error    | unsafe | yes         |
| `noInteractiveElementToNoninteractiveRole` | Disallows non-interactive roles on interactive elements, like `role="img"` on a `button`. | error    | unsafe | yes         |
| `noLabelWithoutControl`                    | Requires every `label` to have text and an associated form control.                       | error    | none   | yes         |
| `noNoninteractiveElementInteractions`      | Disallows event handlers on non-interactive HTML elements, like `onclick` on `<h1>`.      | info     | none   | no          |
| `noNoninteractiveElementToInteractiveRole` | Disallows interactive roles on non-interactive elements, like `role="button"` on an `li`. | error    | unsafe | yes         |
| `noNoninteractiveTabindex`                 | Disallows `tabIndex` on non-interactive elements, so they do not take focus.              | error    | unsafe | yes         |
| `noPositiveTabindex`                       | Disallows a positive `tabIndex`, which breaks the natural tab order.                      | error    | unsafe | yes         |
| `noRedundantAlt`                           | Disallows words like "image" or "photo" in `alt` texts.                                   | error    | none   | yes         |
| `noRedundantRoles`                         | Disallows roles an element has anyway, like `role="button"` on a `button`.                | error    | unsafe | yes         |
| `noStaticElementInteractions`              | Disallows event handlers like `onClick` on static elements like `div`, without a role.    | error    | none   | yes         |
| `noSvgWithoutTitle`                        | Requires a `title` element or an accessible label on every `svg`.                         | error    | none   | yes         |
| `useAltText`                               | Requires `alt`, `aria-label` or `aria-labelledby` on images, image inputs and areas.      | error    | none   | yes         |
| `useAnchorContent`                         | Requires links to have content that screen readers can announce.                          | error    | unsafe | yes         |
| `useAriaActivedescendantWithTabindex`      | Requires elements with `aria-activedescendant` to be focusable with `tabIndex`.           | error    | unsafe | yes         |
| `useAriaPropsForRole`                      | Requires the ARIA attributes a role needs, like `aria-checked` for `role="checkbox"`.     | error    | none   | yes         |
| `useAriaPropsSupportedByRole`              | Disallows ARIA attributes the role of an element does not support.                        | error    | none   | yes         |
| `useButtonType`                            | Requires an explicit `type` on `button` elements, which submit forms by default.          | error    | none   | yes         |
| `useFocusableInteractive`                  | Requires elements with interactive roles to be focusable.                                 | error    | none   | yes         |
| `useGenericFontNames`                      | Requires a generic font family, like `sans-serif`, last in `font-family`.                 | error    | none   | yes         |
| `useHeadingContent`                        | Requires headings to have content that screen readers can announce.                       | error    | none   | yes         |
| `useHtmlLang`                              | Requires a `lang` attribute on the `html` element.                                        | error    | none   | yes         |
| `useIframeTitle`                           | Requires a `title` on `iframe` elements.                                                  | error    | none   | yes         |
| `useKeyWithClickEvents`                    | Requires a keyboard handler, like `onKeyDown`, next to `onClick`.                         | error    | none   | yes         |
| `useKeyWithMouseEvents`                    | Requires `onFocus` and `onBlur` next to `onMouseOver` and `onMouseOut`.                   | error    | none   | yes         |
| `useMediaCaption`                          | Requires a captions `track` in `audio` and `video` elements.                              | error    | none   | yes         |
| `useSemanticElements`                      | Prefers semantic elements to roles, like `button` to `role="button"`.                     | error    | none   | yes         |
| `useValidAnchor`                           | Requires links to have a valid `href`, and buttons to be used for actions instead.        | error    | none   | yes         |
| `useValidAriaProps`                        | Disallows `aria-*` attributes that do not exist.                                          | error    | unsafe | yes         |
| `useValidAriaRole`                         | Requires roles to be valid, non-abstract ARIA roles.                                      | error    | unsafe | yes         |
| `useValidAriaValues`                       | Requires ARIA attributes to have values of the right type.                                | error    | none   | yes         |
| `useValidAutocomplete`                     | Requires valid values for `autocomplete`.                                                 | error    | none   | yes         |
| `useValidLang`                             | Requires a valid language code in `lang`.                                                 | error    | none   | yes         |

### > complexity

Code that can be simpler, with the same result. 36 rules.

| Rule                               | Description                                                                              | Severity | Fix    | Recommended |
| ---------------------------------- | ---------------------------------------------------------------------------------------- | -------- | ------ | ----------- |
| `noAdjacentSpacesInRegex`          | Disallows several spaces in a row in regular expressions, `/ {3}/` shows how many.       | warn     | safe   | yes         |
| `noArguments`                      | Disallows `arguments`, rest parameters are real arrays.                                  | warn     | none   | yes         |
| `noBannedTypes`                    | Disallows the types `String`, `Number`, `Boolean`, `Function`, `Object` and `{}`.        | warn     | safe   | yes         |
| `noCommaOperator`                  | Disallows the comma operator, outside of `for` loop updates.                             | warn     | none   | yes         |
| `noEmptyTypeParameters`            | Disallows empty type parameter lists, like `interface A<> {}`.                           | warn     | none   | yes         |
| `noExcessiveSelectorClasses`       | Disallows CSS selectors with more classes than `maxClasses`.                             | info     | none   | no          |
| `noExtraBooleanCast`               | Disallows `!!` and `Boolean()` where a boolean is implied, like in `if`.                 | info     | safe   | yes         |
| `noFlatMapIdentity`                | Prefers `.flat()` to `.flatMap()` with a callback that returns its argument.             | info     | unsafe | yes         |
| `noImportantStyles`                | Disallows `!important` in CSS declarations.                                              | warn     | unsafe | yes         |
| `noStaticOnlyClass`                | Disallows classes with only static members, a module or an object does the same.         | warn     | none   | yes         |
| `noThisInStatic`                   | Disallows `this` and `super` in static methods, the class name is clearer.               | warn     | unsafe | yes         |
| `noUselessCatch`                   | Disallows `catch` clauses that only rethrow the error.                                   | info     | unsafe | yes         |
| `noUselessConstructor`             | Disallows constructors that do nothing, or only pass their arguments to `super`.         | info     | unsafe | yes         |
| `noUselessContinue`                | Disallows `continue` where the loop would continue anyway.                               | info     | safe   | yes         |
| `noUselessEmptyExport`             | Disallows `export {}` in files that have other imports or exports.                       | info     | safe   | yes         |
| `noUselessEscapeInRegex`           | Disallows escapes in regular expressions that change nothing, like `\a`.                 | info     | safe   | yes         |
| `noUselessFragments`               | Disallows fragments with a single child, or none.                                        | info     | unsafe | yes         |
| `noUselessLabel`                   | Disallows labels that `break` and `continue` do not need.                                | info     | safe   | yes         |
| `noUselessLoneBlockStatements`     | Disallows blocks that are not part of a statement and declare nothing.                   | info     | safe   | yes         |
| `noUselessRename`                  | Disallows renaming to the same name, like `{ a as a }`.                                  | info     | safe   | yes         |
| `noUselessStringRaw`               | Disallows `String.raw` on strings without escapes.                                       | info     | none   | yes         |
| `noUselessSwitchCase`              | Disallows `case` clauses that fall through to `default`.                                 | info     | unsafe | yes         |
| `noUselessTernary`                 | Disallows conditionals that only pick `true` or `false`, like `a ? true : false`.        | info     | unsafe | yes         |
| `noUselessThisAlias`               | Disallows aliases of `this`, like `const self = this`, where arrow functions keep it.    | info     | safe   | yes         |
| `noUselessTypeConstraint`          | Disallows `extends any` and `extends unknown` on type parameters.                        | info     | safe   | yes         |
| `noUselessUndefinedInitialization` | Disallows initializing variables to `undefined`.                                         | info     | safe   | yes         |
| `useArrowFunction`                 | Prefers arrow functions to function expressions that do not use `this`.                  | warn     | safe   | yes         |
| `useDateNow`                       | Prefers `Date.now()` to `new Date().getTime()` and similar.                              | warn     | unsafe | yes         |
| `useFlatMap`                       | Prefers `.flatMap()` to `.map().flat()`.                                                 | info     | safe   | yes         |
| `useIndexOf`                       | Prefers `indexOf` to `findIndex` with a callback that only compares the item.            | info     | unsafe | yes         |
| `useLiteralKeys`                   | Prefers `a.b` and `{ b: 1 }` to `a["b"]` and `{ ["b"]: 1 }`.                             | info     | unsafe | yes         |
| `useMathMinMax`                    | Prefers `Math.min` and `Math.max` to conditionals that pick the smaller or larger value. | warn     | unsafe | yes         |
| `useNumericLiterals`               | Prefers binary, octal and hexadecimal literals to `parseInt` with a radix.               | warn     | safe   | yes         |
| `useOptionalChain`                 | Prefers optional chaining to chains of `&&` checks, like `a && a.b`.                     | warn     | unsafe | yes         |
| `useRegexLiterals`                 | Prefers regular expression literals to `new RegExp` with literal strings.                | warn     | safe   | yes         |
| `useSimpleNumberKeys`              | Prefers plain decimal numbers as object keys, to `0x1` or `1e3`.                         | warn     | safe   | yes         |

### > correctness

Code that is certainly wrong, or does not do what it seems to. 70 rules.

| Rule                                 | Description                                                                                | Severity | Fix    | Recommended     |
| ------------------------------------ | ------------------------------------------------------------------------------------------ | -------- | ------ | --------------- |
| `noChildrenProp`                     | Disallows passing children as the `children` prop, instead of nesting them.                | error    | none   | `react`         |
| `noComponentHookFactories`           | Disallows defining components and hooks inside other functions.                            | error    | none   | `react`         |
| `noConstantCondition`                | Disallows conditions that are always true or always false.                                 | error    | none   | yes             |
| `noConstantMathMinMaxClamp`          | Disallows `Math.min` and `Math.max` combinations that always give the same result.         | error    | unsafe | yes             |
| `noConstAssign`                      | Disallows assigning to `const` variables.                                                  | error    | unsafe | yes             |
| `noConstructorReturn`                | Disallows returning a value from a constructor.                                            | error    | none   | yes             |
| `noDuplicateAttributes`              | Disallows HTML attributes written twice on an element.                                     | error    | none   | yes             |
| `noEmptyCharacterClassInRegex`       | Disallows empty character classes in regular expressions, like `[]`, which match nothing.  | error    | none   | yes             |
| `noEmptyPattern`                     | Disallows empty destructuring patterns, like `const {} = a`.                               | error    | none   | yes             |
| `noGlobalObjectCalls`                | Disallows calling objects like `Math`, `JSON` and `Reflect` as functions.                  | error    | none   | yes             |
| `noInnerDeclarations`                | Requires `var` and function declarations at the root of their function or file.            | error    | none   | yes             |
| `noInvalidBuiltinInstantiation`      | Requires `new` for builtins like `Map`, and disallows it for `Symbol` and `BigInt`.        | error    | unsafe | yes             |
| `noInvalidConstructorSuper`          | Requires `super()` in constructors of derived classes, and disallows it in others.         | error    | none   | yes             |
| `noInvalidDirectionInLinearGradient` | Disallows non-standard `linear-gradient()` directions, like `top`.                         | error    | none   | yes             |
| `noInvalidGridAreas`                 | Disallows malformed grid template areas: empty, uneven or non-rectangular.                 | error    | none   | yes             |
| `noInvalidPositionAtImportRule`      | Disallows `@import` after other CSS rules, where it is ignored.                            | error    | none   | yes             |
| `noInvalidUseBeforeDeclaration`      | Disallows using variables and parameters before they are declared.                         | error    | none   | yes             |
| `noJsxNamespace`                     | Disallows namespaced JSX names, like `<a:b>`, which React does not support.                | error    | none   | `react`         |
| `noMissingVarFunction`               | Disallows CSS custom properties used without `var()`, like `color: --a`.                   | error    | none   | yes             |
| `noNonoctalDecimalEscape`            | Disallows the escapes `\8` and `\9` in strings.                                            | error    | safe   | yes             |
| `noPlaywrightMissingAwait`           | Requires `await` on asynchronous Playwright calls, like `expect(...).toBeVisible()`.       | error    | unsafe | `playwright`    |
| `noPrecisionLoss`                    | Disallows number literals that cannot be represented exactly, like `9007199254740993`.     | error    | none   | yes             |
| `noPrivateImports`                   | Disallows importing `@private` or `@package` symbols from outside their scope.             | warn     | none   | `project`       |
| `noQwikUseVisibleTask`               | Disallows `useVisibleTask$`, which runs eagerly in the browser.                            | error    | none   | `qwik`          |
| `noReactNativeRawText`               | Requires text in React Native to be inside a `Text` component.                             | error    | none   | `reactNative`   |
| `noRenderReturnValue`                | Disallows using the return value of `ReactDOM.render()`.                                   | error    | none   | `react`         |
| `noRestrictedElements`               | Disallows the HTML elements named in the `elements` option.                                | info     | none   | no              |
| `noSelfAssign`                       | Disallows assigning a variable or property to itself.                                      | error    | none   | yes             |
| `noSetterReturn`                     | Disallows returning a value from a setter.                                                 | error    | none   | yes             |
| `noStringCaseMismatch`               | Disallows comparing `toUpperCase()` or `toLowerCase()` with a string of the other case.    | error    | unsafe | yes             |
| `noSwitchDeclarations`               | Requires declarations in `case` clauses to be wrapped in a block.                          | error    | safe   | yes             |
| `noUnknownFunction`                  | Disallows CSS functions that do not exist.                                                 | error    | none   | yes             |
| `noUnknownMediaFeatureName`          | Disallows media features that do not exist, like `(max-widht: 1px)`.                       | error    | none   | yes             |
| `noUnknownProperty`                  | Disallows CSS properties that do not exist.                                                | error    | none   | yes             |
| `noUnknownPseudoClass`               | Disallows CSS pseudo-classes that do not exist.                                            | error    | none   | yes             |
| `noUnknownPseudoElement`             | Disallows CSS pseudo-elements that do not exist.                                           | error    | none   | yes             |
| `noUnknownTypeSelector`              | Disallows type selectors of elements that do not exist in HTML, SVG and MathML.            | error    | none   | yes             |
| `noUnknownUnit`                      | Disallows CSS units that do not exist.                                                     | error    | none   | yes             |
| `noUnmatchableAnbSelector`           | Disallows An+B selectors that never match, like `:nth-child(0)`.                           | error    | none   | yes             |
| `noUnreachable`                      | Disallows code that can never run, like after `return`.                                    | error    | none   | yes             |
| `noUnreachableSuper`                 | Requires constructors to call `super()` exactly once before `this`, on every path.         | error    | none   | yes             |
| `noUnsafeFinally`                    | Disallows `return`, `throw`, `break` and `continue` in `finally`.                          | error    | none   | yes             |
| `noUnsafeOptionalChaining`           | Disallows optional chains where `undefined` throws, like `(a?.b)()` or `new a?.b()`.       | error    | none   | yes             |
| `noUnusedFunctionParameters`         | Disallows unused function parameters.                                                      | warn     | unsafe | yes             |
| `noUnusedImports`                    | Disallows unused imports.                                                                  | warn     | unsafe | yes             |
| `noUnusedLabels`                     | Disallows unused labels.                                                                   | warn     | safe   | yes             |
| `noUnusedPrivateClassMembers`        | Disallows unused private class members.                                                    | warn     | unsafe | yes             |
| `noUnusedVariables`                  | Disallows unused variables, functions and classes.                                         | warn     | unsafe | yes             |
| `noVoidElementsWithChildren`         | Disallows children on void elements, like `img` and `br`.                                  | error    | unsafe | yes             |
| `noVoidTypeReturn`                   | Disallows returning a value from functions whose return type is `void`.                    | error    | none   | yes             |
| `noVueDataObjectDeclaration`         | Requires `data` in Vue components to be a function, not an object.                         | error    | safe   | `vue`           |
| `noVueRefAsOperand`                  | Requires `.value` to read Vue refs in expressions.                                         | error    | none   | `vue`           |
| `noVueReservedProps`                 | Disallows props named after reserved Vue attributes, like `key` and `ref`.                 | error    | none   | `vue`           |
| `useExhaustiveDependencies`          | Requires hook dependency arrays to list exactly the values the hook uses.                  | error    | unsafe | `react`, `next` |
| `useHookAtTopLevel`                  | Requires hooks to be called at the top level of components and hooks, never conditionally. | error    | none   | `react`, `next` |
| `useImageSize`                       | Requires `width` and `height` on `img` elements in Qwik, to prevent layout shifts.         | error    | none   | `qwik`          |
| `useInlineScriptId`                  | Requires an `id` on `next/script` components with inline content.                          | error    | none   | `next`          |
| `useIsNan`                           | Requires `Number.isNaN()` to check for `NaN`, which equals nothing, not even itself.       | error    | unsafe | yes             |
| `useJsxKeyInIterable`                | Requires a `key` on JSX elements created in arrays and iterators.                          | error    | none   | `react`, `qwik` |
| `useParseIntRadix`                   | Requires a radix in `parseInt()`.                                                          | info     | unsafe | yes             |
| `usePlaywrightValidDescribeCallback` | Requires `test.describe` callbacks to be synchronous and take no parameters.               | error    | none   | `playwright`    |
| `useQwikClasslist`                   | Prefers Qwik's `class` with objects and arrays to `classnames`-like utilities.             | error    | none   | `qwik`          |
| `useQwikLoaderLocation`              | Requires `routeLoader$` and `routeAction$` to be exported from route files.                | error    | none   | `qwik`          |
| `useQwikMethodUsage`                 | Requires Qwik hooks to be called only in `component$` and other hooks.                     | error    | none   | `qwik`          |
| `useQwikValidLexicalScope`           | Requires values captured by `$()` closures to be serializable.                             | error    | none   | `qwik`          |
| `useReactAsyncServerFunction`        | Requires functions with `"use server"` to be `async`.                                      | error    | unsafe | `react`         |
| `useReactNativePlatformComponents`   | Disallows mixing iOS and Android components in one file.                                   | error    | none   | `reactNative`   |
| `useValidForDirection`               | Requires the update of a `for` loop to move its counter towards the end condition.         | error    | none   | yes             |
| `useValidTypeof`                     | Requires `typeof` to be compared with valid type names, like `"string"`.                   | error    | unsafe | yes             |
| `useYield`                           | Requires generator functions to `yield`.                                                   | error    | none   | yes             |

### > nursery

New rules that may still change. No preset enables them, only their own level does. 23 rules.

| Rule                                     | Description                                                                                | Severity | Fix    | Recommended |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ | -------- | ------ | ----------- |
| `noExcessiveNestedBlocks`                | Disallows blocks nested deeper than `max` levels, 4 by default.                            | warn     | none   | no          |
| `noInvalidFileInputAccept`               | Requires valid file types in the `accept` of file inputs.                                  | error    | unsafe | no          |
| `noMisplacedListElements`                | Disallows `<li>` outside `<ul>`, `<ol>` and `<menu>`.                                      | error    | none   | no          |
| `noNonScalableViewport`                  | Disallows viewports that disable zooming with `user-scalable=no`.                          | error    | none   | no          |
| `noObsoleteAttributes`                   | Disallows HTML attributes the HTML standard made obsolete, like `align` on `<div>`.        | warn     | none   | no          |
| `noObsoleteTags`                         | Disallows HTML elements the HTML standard made obsolete, like `<center>`.                  | warn     | none   | no          |
| `noPseudoElementInFunctionalPseudoClass` | Disallows pseudo-elements in `:is()`, `:where()`, `:not()` and `:has()`.                   | error    | none   | no          |
| `noSelfNestedLayer`                      | Disallows CSS layers named like the layer they are nested in, which makes a sublayer.      | warn     | none   | no          |
| `noShortTimeValues`                      | Disallows CSS animation and transition times shorter than `minimum` milliseconds.          | info     | none   | no          |
| `noUndeclaredCustomProperties`           | Disallows `var()` of CSS custom properties no stylesheet declares, also those it imports.  | info     | none   | no          |
| `noUnsafeIframeSandbox`                  | Disallows `allow-scripts` with `allow-same-origin` in iframe sandboxes, which undoes them. | error    | none   | no          |
| `noUnusedClasses`                        | Disallows CSS classes outside `:global()` that no known file uses.                         | info     | none   | no          |
| `noZeroLengthUnit`                       | Disallows units on zero lengths, like `0px`, outside math functions.                       | info     | unsafe | no          |
| `useConsistentHeadingLevel`              | Disallows headings that skip a level, like `###` after `#`.                                | info     | none   | no          |
| `useConsistentLightnessNotation`         | Requires lightness of `oklch()`, `lab()` and similar as a percentage, or by `notation`.    | info     | safe   | no          |
| `useConsistentUnicodeBom`                | Disallows, or with `bom: "always"` requires, a byte order mark.                            | info     | safe   | no          |
| `useControlLabel`                        | Requires buttons and menu items to have an accessible label.                               | error    | none   | no          |
| `useFencedCodeLanguage`                  | Requires a language, from `allowedLanguages`, on fenced code blocks.                       | info     | none   | no          |
| `useLayeredStyles`                       | Requires CSS rules and imports in cascade layers.                                          | warn     | none   | no          |
| `useLogicalProperties`                   | Prefers logical CSS properties, like `margin-inline-start` to `margin-left`.               | warn     | unsafe | no          |
| `useNamedLayer`                          | Disallows anonymous CSS cascade layers.                                                    | warn     | none   | no          |
| `useSingleTopLevelHeading`               | Disallows more than one top-level heading in a document.                                   | info     | none   | no          |
| `useTopLevelHeading`                     | Requires documents to start with a level 1 heading.                                        | info     | none   | no          |

### > performance

Code that is slower or bigger than it needs to be. 7 rules.

| Rule                             | Description                                                                                | Severity | Fix    | Recommended |
| -------------------------------- | ------------------------------------------------------------------------------------------ | -------- | ------ | ----------- |
| `noAccumulatingSpread`           | Disallows spreading the accumulator in `reduce`, which copies it on every call.            | warn     | none   | yes         |
| `noDynamicNamespaceImportAccess` | Disallows dynamic access to namespace imports, like `ns[key]`, which defeats tree shaking. | warn     | none   | yes         |
| `noImgElement`                   | Prefers `next/image` to `img` elements in Next.js.                                         | warn     | none   | `next`      |
| `noSyncScripts`                  | Disallows scripts with a `src` but no `async`, `defer` or `type="module"`.                 | warn     | none   | no          |
| `noUnwantedPolyfillio`           | Disallows Polyfill.io scripts, Next.js includes the polyfills already.                     | warn     | none   | `next`      |
| `useDomNodeTextContent`          | Prefers `textContent` to `innerText`, which forces a layout.                               | warn     | unsafe | yes         |
| `useGoogleFontPreconnect`        | Requires `rel="preconnect"` on links to Google Fonts.                                      | info     | safe   | `next`      |

### > security

Code that opens the way to attacks. 6 rules.

| Rule                                    | Description                                                                      | Severity | Fix  | Recommended |
| --------------------------------------- | -------------------------------------------------------------------------------- | -------- | ---- | ----------- |
| `noBlankTarget`                         | Requires `rel="noopener"` or `rel="noreferrer"` on links with `target="_blank"`. | error    | safe | yes         |
| `noDangerouslySetInnerHtml`             | Disallows `dangerouslySetInnerHTML`, an easy way to cross-site scripting.        | error    | none | `react`     |
| `noDangerouslySetInnerHtmlWithChildren` | Disallows `dangerouslySetInnerHTML` together with children.                      | error    | none | `react`     |
| `noGlobalEval`                          | Disallows `eval()`.                                                              | error    | none | yes         |
| `noScriptUrl`                           | Disallows `javascript:` URLs.                                                    | error    | none | yes         |
| `useIframeSandbox`                      | Requires a `sandbox` on iframes.                                                 | error    | none | no          |

### > style

A consistent way to write the same thing. 17 rules.

| Rule                            | Description                                                                             | Severity | Fix    | Recommended |
| ------------------------------- | --------------------------------------------------------------------------------------- | -------- | ------ | ----------- |
| `noDescendingSpecificity`       | Disallows CSS selectors after more specific ones that style the same elements.          | warn     | none   | yes         |
| `noExcessiveLinesPerFile`       | Disallows HTML and CSS files longer than `maxLines`, 300 by default.                    | info     | none   | no          |
| `noHeadElement`                 | Prefers `next/head` to `head` elements in Next.js pages.                                | warn     | none   | `next`      |
| `noHexColors`                   | Disallows hex colors in CSS.                                                            | info     | none   | no          |
| `noInlineStyles`                | Disallows the `style` attribute in HTML.                                                | info     | unsafe | no          |
| `noNonNullAssertion`            | Disallows non-null assertions, like `a!.b`.                                             | warn     | unsafe | yes         |
| `noValueAtRule`                 | Disallows `@value` of CSS Modules.                                                      | info     | none   | no          |
| `useArrayLiterals`              | Prefers array literals to the `Array` constructor.                                      | info     | safe   | yes         |
| `useConst`                      | Prefers `const` to `let` for variables assigned only once.                              | warn     | safe   | yes         |
| `useExponentiationOperator`     | Prefers `**` to `Math.pow()`.                                                           | info     | safe   | yes         |
| `useExportType`                 | Requires `export type` for exports that are only types.                                 | warn     | safe   | yes         |
| `useImportType`                 | Requires `import type` for imports used only as types.                                  | warn     | safe   | yes         |
| `useLiteralEnumMembers`         | Requires enum members to be initialized with literals.                                  | warn     | none   | yes         |
| `useNodejsImportProtocol`       | Requires the `node:` protocol for Node.js builtin modules, like `node:fs`.              | info     | unsafe | yes         |
| `useShorthandFunctionType`      | Prefers function types to interfaces and type literals with only a call signature.      | info     | safe   | yes         |
| `useTemplate`                   | Prefers template literals to string concatenation.                                      | info     | unsafe | yes         |
| `useVueMultiWordComponentNames` | Requires Vue component names of several words, so they cannot clash with HTML elements. | info     | none   | `vue`       |

### > suspicious

Code that is likely a mistake. 90 rules.

| Rule                                | Description                                                                             | Severity | Fix    | Recommended     |
| ----------------------------------- | --------------------------------------------------------------------------------------- | -------- | ------ | --------------- |
| `noApproximativeNumericConstant`    | Prefers constants like `Math.PI` to approximations like `3.14`.                         | warn     | unsafe | yes             |
| `noArrayIndexKey`                   | Disallows array indexes as `key`, which breaks when items move.                         | error    | none   | `react`         |
| `noAssignInExpressions`             | Disallows assignments in expressions, like `if (a = b)`.                                | error    | none   | yes             |
| `noAsyncPromiseExecutor`            | Disallows `async` executor functions in `new Promise()`.                                | error    | none   | yes             |
| `noBiomeFirstException`             | Requires `files.includes` of the linter configuration to start with `**`.               | error    | safe   | yes             |
| `noCatchAssign`                     | Disallows assigning to the parameter of a `catch` clause.                               | warn     | none   | yes             |
| `noClassAssign`                     | Disallows assigning to class declarations.                                              | error    | none   | yes             |
| `noCommentText`                     | Disallows text that looks like a comment in JSX, like `// note`, which is rendered.     | error    | unsafe | yes             |
| `noCompareNegZero`                  | Disallows comparing with `-0`, `Object.is()` tells it apart.                            | error    | safe   | yes             |
| `noConfusingLabels`                 | Allows labels only on loops.                                                            | warn     | none   | yes             |
| `noConfusingVoidType`               | Allows `void` only as a return type or type argument.                                   | warn     | unsafe | yes             |
| `noConstEnum`                       | Disallows `const enum`, which isolated module compilers like esbuild cannot compile.    | warn     | safe   | yes             |
| `noControlCharactersInRegex`        | Disallows control characters in regular expressions, like `\x0C`.                       | error    | none   | yes             |
| `noDebugger`                        | Disallows `debugger` statements.                                                        | error    | unsafe | yes             |
| `noDeprecatedMediaType`             | Disallows deprecated media types, like `tv` and `handheld`.                             | warn     | none   | yes             |
| `noDocumentCookie`                  | Disallows assigning to `document.cookie`, prefer the Cookie Store API.                  | warn     | none   | yes             |
| `noDocumentImportInPage`            | Allows `next/document` only in `pages/_document`.                                       | warn     | none   | `next`          |
| `noDoubleEquals`                    | Requires `===` and `!==`, which do not coerce types.                                    | error    | unsafe | yes             |
| `noDrizzleDeleteWithoutWhere`       | Requires `.where()` on Drizzle `delete` queries, which otherwise delete every row.      | error    | none   | `drizzle`       |
| `noDrizzleUpdateWithoutWhere`       | Requires `.where()` on Drizzle `update` queries, which otherwise update every row.      | error    | none   | `drizzle`       |
| `noDuplicateAtImportRules`          | Disallows importing a stylesheet twice with the same media queries.                     | error    | none   | yes             |
| `noDuplicateCase`                   | Disallows duplicate `case` labels.                                                      | error    | none   | yes             |
| `noDuplicateClassMembers`           | Disallows duplicate class member names.                                                 | error    | none   | yes             |
| `noDuplicateCustomProperties`       | Disallows CSS custom properties declared twice in a block.                              | error    | none   | yes             |
| `noDuplicateElseIf`                 | Disallows conditions an earlier `else if` of the same chain already covers.             | error    | none   | yes             |
| `noDuplicateEnumValues`             | Disallows duplicate enum member values.                                                 | warn     | none   | yes             |
| `noDuplicateFontNames`              | Disallows font names written twice in CSS `font` and `font-family`.                     | error    | none   | yes             |
| `noDuplicateJsxProps`               | Disallows duplicate JSX props.                                                          | error    | none   | yes             |
| `noDuplicateObjectKeys`             | Disallows duplicate keys in objects and JSON.                                           | error    | unsafe | yes             |
| `noDuplicateParameters`             | Disallows duplicate parameter names.                                                    | error    | none   | yes             |
| `noDuplicateProperties`             | Disallows CSS properties declared twice in a block.                                     | error    | none   | yes             |
| `noDuplicateSelectors`              | Disallows CSS rules with the selectors of an earlier rule.                              | warn     | none   | no              |
| `noDuplicateSelectorsKeyframeBlock` | Disallows keyframe selectors written twice in `@keyframes`.                             | error    | none   | yes             |
| `noDuplicateTestHooks`              | Disallows several hooks of the same kind, like two `beforeEach`, in one block.          | error    | none   | `test`          |
| `noEmptyBlock`                      | Disallows empty CSS blocks.                                                             | warn     | none   | yes             |
| `noEmptyInterface`                  | Disallows empty interfaces, which accept almost anything.                               | error    | safe   | yes             |
| `noEmptySource`                     | Disallows empty modules, Markdown and CSS files.                                        | warn     | none   | no              |
| `noExplicitAny`                     | Disallows the `any` type.                                                               | warn     | none   | yes             |
| `noExportsInTest`                   | Disallows exports from test files.                                                      | error    | none   | `test`          |
| `noExtraNonNullAssertion`           | Disallows repeated or needless non-null assertions, like `a!!`.                         | warn     | safe   | yes             |
| `noFallthroughSwitchClause`         | Disallows `case` clauses that fall through to the next one.                             | error    | none   | yes             |
| `noFocusedTests`                    | Disallows focused tests, like `test.only` and `fdescribe`, which skip the rest.         | warn     | unsafe | `test`          |
| `noFunctionAssign`                  | Disallows assigning to function declarations.                                           | error    | none   | yes             |
| `noGlobalAssign`                    | Disallows assigning to builtin globals, like `window` or `Object`.                      | error    | none   | yes             |
| `noGlobalIsFinite`                  | Prefers `Number.isFinite()` to the global `isFinite()`, which coerces its argument.     | warn     | unsafe | yes             |
| `noGlobalIsNan`                     | Prefers `Number.isNaN()` to the global `isNaN()`, which coerces its argument.           | warn     | unsafe | yes             |
| `noHeadImportInDocument`            | Disallows `next/head` in `pages/_document`.                                             | warn     | none   | `next`          |
| `noIdenticalTestTitle`              | Disallows tests and suites with the same title in one block.                            | warn     | none   | `test`          |
| `noImplicitAnyLet`                  | Requires a type or a value on `let` and `var` declarations, which are `any` otherwise.  | error    | none   | yes             |
| `noImportantInKeyframe`             | Disallows `!important` in `@keyframes`, where browsers ignore it.                       | error    | none   | yes             |
| `noImportAssign`                    | Disallows assigning to imports.                                                         | error    | none   | yes             |
| `noIrregularWhitespace`             | Disallows irregular whitespace, like non-breaking spaces, outside strings and comments. | warn     | none   | yes             |
| `noLabelVar`                        | Disallows labels with the name of a variable.                                           | error    | none   | yes             |
| `noMisleadingCharacterClass`        | Disallows characters made of several code points in character classes, like emoji.      | error    | safe   | yes             |
| `noMisleadingInstantiator`          | Disallows `new` in interfaces and `constructor` in type literals.                       | error    | none   | yes             |
| `noMisrefactoredShorthandAssign`    | Disallows `a += a + b`, which is likely meant to be `a += b`.                           | error    | unsafe | yes             |
| `noNonNullAssertedOptionalChain`    | Disallows non-null assertions after optional chains, like `a?.b!`.                      | error    | none   | yes             |
| `noOctalEscape`                     | Disallows octal escapes in strings, like `\251`.                                        | warn     | safe   | yes             |
| `noProto`                           | Disallows `__proto__`, prefer `Object.getPrototypeOf()` and `Object.setPrototypeOf()`.  | warn     | none   | yes             |
| `noPrototypeBuiltins`               | Prefers `Object.hasOwn()` to calling `Object.prototype` methods on objects.             | warn     | safe   | yes             |
| `noQuickfixBiome`                   | Prefers the `source.fixAll.*` code action to the deprecated `quickfix.*` one.           | info     | safe   | yes             |
| `noReactNativeDeepImports`          | Disallows importing React Native internals, like `react-native/Libraries/...`.          | error    | none   | `reactNative`   |
| `noReactSpecificProps`              | Prefers `class` and `for` to `className` and `htmlFor` in Solid and Qwik.               | warn     | safe   | `solid`, `qwik` |
| `noReactStringRefs`                 | Disallows string refs, which React deprecated.                                          | warn     | none   | `react`         |
| `noRedeclare`                       | Disallows declaring a variable, function or type twice in the same scope.               | error    | none   | yes             |
| `noRedundantUseStrict`              | Disallows `"use strict"` in modules and classes, which are strict already.              | warn     | safe   | yes             |
| `noSelfCompare`                     | Disallows comparing an expression with itself.                                          | error    | none   | yes             |
| `noShadowRestrictedNames`           | Disallows shadowing globals like `NaN`, `Infinity` and `undefined`.                     | error    | none   | yes             |
| `noShorthandPropertyOverrides`      | Disallows CSS shorthand properties that override earlier longhand ones.                 | error    | none   | yes             |
| `noSparseArray`                     | Disallows holes in array literals, like `[1, , 2]`.                                     | error    | unsafe | yes             |
| `noSuspiciousSemicolonInJsx`        | Disallows semicolons in JSX text, likely left there by mistake.                         | warn     | none   | yes             |
| `noTemplateCurlyInString`           | Disallows `${}` placeholders in plain strings, which are not interpolated.              | warn     | none   | yes             |
| `noThenProperty`                    | Disallows `then` properties, which make objects look like promises.                     | error    | none   | yes             |
| `noTsIgnore`                        | Prefers `@ts-expect-error` to `@ts-ignore`.                                             | warn     | safe   | yes             |
| `noUndeclaredEnvVars`               | Requires environment variables to be listed in `turbo.json`.                            | warn     | none   | `turborepo`     |
| `noUnknownAtRules`                  | Disallows CSS at-rules that do not exist.                                               | error    | none   | yes             |
| `noUnsafeDeclarationMerging`        | Disallows merging a class and an interface, which TypeScript does not check.            | error    | none   | yes             |
| `noUnsafeNegation`                  | Disallows negating the left side of `in` and `instanceof`, like `!a in b`.              | error    | unsafe | yes             |
| `noUselessEscapeInString`           | Disallows escapes in strings that change nothing, like `\a`.                            | warn     | safe   | yes             |
| `noUselessRegexBackrefs`            | Disallows backreferences in regular expressions that always match an empty string.      | warn     | none   | yes             |
| `noWith`                            | Disallows `with` statements.                                                            | error    | none   | yes             |
| `useAdjacentOverloadSignatures`     | Requires overload signatures of a function to be next to each other.                    | warn     | none   | yes             |
| `useBaseline`                       | Disallows CSS features that are not Baseline `available`, widely by default.            | warn     | none   | no              |
| `useBiomeIgnoreFolder`              | Prefers `!folder` to `!folder/**` in the linter configuration.                          | warn     | safe   | yes             |
| `useDefaultSwitchClauseLast`        | Requires `default` to be the last clause of a `switch`.                                 | warn     | none   | yes             |
| `useGetterReturn`                   | Requires getters to return a value.                                                     | error    | none   | yes             |
| `useGoogleFontDisplay`              | Requires a `display` parameter in Google Fonts URLs.                                    | warn     | none   | yes             |
| `useIsArray`                        | Prefers `Array.isArray()` to `instanceof Array`.                                        | warn     | unsafe | yes             |
| `useIterableCallbackReturn`         | Requires `map`, `filter` and similar callbacks to return, and `forEach` ones not to.    | error    | none   | yes             |
| `useNamespaceKeyword`               | Prefers `namespace` to the outdated `module` keyword for TypeScript namespaces.         | error    | safe   | yes             |

## > How it works

```
source
├─> @aljazmc/syntax   parses it into a syntax tree
├─> src/analysis      finds scopes, references, control flow and the rules that run
└─> src/rules         visit the tree in one traversal, reporting problems and fixes
```

| Module                         | Description                                                        |
| ------------------------------ | ------------------------------------------------------------------ |
| `@aljazmc/config`              | Loads `lintero.config.ts`, finds files and matches `includes`.     |
| `@aljazmc/syntax`              | Parses sources into syntax trees and walks them.                   |
| `src/analysis/aria.ts`         | ARIA roles, attributes and the implicit roles of elements.         |
| `src/analysis/css*.ts`         | CSS values, selectors, specificity and known CSS names.            |
| `src/analysis/flow.ts`         | How statements complete, for unreachable code and fallthrough.     |
| `src/analysis/semantic.ts`     | Scopes, bindings and references, telling types from values.        |
| `src/analysis/settings.ts`     | Resolves presets, domains, groups and rules to the rules that run. |
| `src/analysis/suppressions.ts` | Reads suppression comments and reports unused or malformed ones.   |
| `src/assist`                   | Assist actions, like organizing imports.                           |
| `src/rules`                    | One file per rule, sharing a single traversal.                     |

## > License

MIT, see [LICENSE](LICENSE).
