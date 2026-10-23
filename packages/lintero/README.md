![Custom](https://img.shields.io/badge/project_status-barely_working-yellow) ![Custom](https://img.shields.io/badge/breaking_changes-common-red) ![NPM Downloads](https://img.shields.io/npm/dm/%40aljazmc%2Flintero) ![GitHub package.json version](https://img.shields.io/github/package-json/v/aljazmc/aljazmc?filename=packages%2Flintero%2Fpackage.json&color=green) ![GitHub License](https://img.shields.io/github/license/aljazmc/aljazmc)

# > lintero

A simple, Biome-like linter. Easy to understand, easy to customize and easy to extend.

## > usage

```sh
lintero                   # report problems, exit 1 if there are errors
lintero --write           # apply safe fixes, then report what is left
lintero --write --unsafe  # apply unsafe fixes too
```

JavaScript, TypeScript, JSX and JSON files are checked with Biome-like lint rules, aiming for the same diagnostics, positions and messages as [Biome](https://biomejs.dev/linter/):

```text
warn: src/a.ts:3:8 lint/suspicious/noExplicitAny: Unexpected any. Specify a different type.
```

Settings are Biome-like, with the same names and defaults as Biome's linter settings, and the recommended rules enabled. Override them with `lintero.config.ts` or `lintero.config.js` in the current directory; objects are merged deeply, anything else (like `ignore`) replaces the default:

```js
export default {
    ignore: [".git", "node_modules"],
    rules: {
        enabled: true,
        includes: ["**"], // globs of files to lint in order, the last match decides, "!" excludes
        domains: {}, // like { react: "recommended", test: "none" }: "all" | "recommended" | "none"
        preset: "recommended", // "recommended" | "all" | "none"
        // per group: a level for all of its rules, or a level or configuration per rule
        // levels: "off" | "on" (the rule's severity) | "info" | "warn" | "error"
        suspicious: {
            noDebugger: "off",
            noDoubleEquals: {
                level: "warn",
                fix: "none",
                options: { ignoreNull: false },
            },
        },
        style: "error",
        javascript: {
            enabled: true,
            globals: [],
            jsxRuntime: "transparent", // "transparent" | "reactClassic"
        },
        json: {
            enabled: true,
        },
    },
};
```

Domains are also enabled, with their recommended rules, when the `package.json` closest to a file depends on their packages, like `jest` or `vitest` for `test`.

Diagnostics are suppressed with Biome-like comments, `biome-ignore` or `lintero-ignore`, followed by categories and a reason:

```js
// biome-ignore lint/suspicious/noDebugger: the line of the next token
// biome-ignore-all lint/style: the whole file
// biome-ignore-start lint: up to the matching biome-ignore-end
```

Suppressions that suppress nothing are reported when they name rules lintero implements; with others, lintero cannot tell.

## > rules

- a11y (17): `noAccessKey`, `noAriaHiddenOnFocusable`, `noAutofocus`, `noDistractingElements`, `noHeaderScope`, `noPositiveTabindex`, `noRedundantAlt`, `noSvgWithoutTitle`, `useAltText`, `useAnchorContent`, `useButtonType`, `useHeadingContent`, `useHtmlLang`, `useIframeTitle`, `useKeyWithClickEvents`, `useKeyWithMouseEvents`, `useMediaCaption`
- complexity (31): `noAdjacentSpacesInRegex`, `noArguments`, `noBannedTypes`, `noCommaOperator`, `noEmptyTypeParameters`, `noExtraBooleanCast`, `noFlatMapIdentity`, `noStaticOnlyClass`, `noThisInStatic`, `noUselessCatch`, `noUselessConstructor`, `noUselessContinue`, `noUselessEmptyExport`, `noUselessFragments`, `noUselessLabel`, `noUselessLoneBlockStatements`, `noUselessRename`, `noUselessStringRaw`, `noUselessSwitchCase`, `noUselessTernary`, `noUselessThisAlias`, `noUselessTypeConstraint`, `noUselessUndefinedInitialization`, `useArrowFunction`, `useDateNow`, `useFlatMap`, `useIndexOf`, `useLiteralKeys`, `useNumericLiterals`, `useRegexLiterals`, `useSimpleNumberKeys`
- correctness (32): `noConstantCondition`, `noConstantMathMinMaxClamp`, `noConstAssign`, `noConstructorReturn`, `noEmptyCharacterClassInRegex`, `noEmptyPattern`, `noGlobalObjectCalls`, `noInnerDeclarations`, `noInvalidBuiltinInstantiation`, `noInvalidConstructorSuper`, `noInvalidUseBeforeDeclaration`, `noNonoctalDecimalEscape`, `noPrecisionLoss`, `noSelfAssign`, `noSetterReturn`, `noStringCaseMismatch`, `noSwitchDeclarations`, `noUnreachable`, `noUnsafeFinally`, `noUnsafeOptionalChaining`, `noUnusedFunctionParameters`, `noUnusedImports`, `noUnusedLabels`, `noUnusedPrivateClassMembers`, `noUnusedVariables`, `noVoidElementsWithChildren`, `noVoidTypeReturn`, `useIsNan`, `useParseIntRadix`, `useValidForDirection`, `useValidTypeof`, `useYield`
- performance (2): `noAccumulatingSpread`, `noDynamicNamespaceImportAccess`
- security (3): `noBlankTarget`, `noGlobalEval`, `noScriptUrl`
- style (10): `noNonNullAssertion`, `useArrayLiterals`, `useConst`, `useExponentiationOperator`, `useExportType`, `useImportType`, `useLiteralEnumMembers`, `useNodejsImportProtocol`, `useShorthandFunctionType`, `useTemplate`
- suspicious (58): `noApproximativeNumericConstant`, `noAssignInExpressions`, `noAsyncPromiseExecutor`, `noCatchAssign`, `noClassAssign`, `noCommentText`, `noCompareNegZero`, `noConfusingLabels`, `noConfusingVoidType`, `noConstEnum`, `noControlCharactersInRegex`, `noDebugger`, `noDocumentCookie`, `noDoubleEquals`, `noDuplicateCase`, `noDuplicateClassMembers`, `noDuplicateElseIf`, `noDuplicateEnumValues`, `noDuplicateJsxProps`, `noDuplicateObjectKeys`, `noDuplicateParameters`, `noEmptyInterface`, `noExplicitAny`, `noExtraNonNullAssertion`, `noFallthroughSwitchClause`, `noFocusedTests`, `noFunctionAssign`, `noGlobalAssign`, `noGlobalIsFinite`, `noGlobalIsNan`, `noImplicitAnyLet`, `noImportAssign`, `noIrregularWhitespace`, `noLabelVar`, `noMisleadingInstantiator`, `noMisrefactoredShorthandAssign`, `noNonNullAssertedOptionalChain`, `noOctalEscape`, `noProto`, `noPrototypeBuiltins`, `noRedeclare`, `noSelfCompare`, `noShadowRestrictedNames`, `noSparseArray`, `noSuspiciousSemicolonInJsx`, `noTemplateCurlyInString`, `noThenProperty`, `noTsIgnore`, `noUnsafeDeclarationMerging`, `noUnsafeNegation`, `noUselessEscapeInString`, `noWith`, `useAdjacentOverloadSignatures`, `useDefaultSwitchClauseLast`, `useGetterReturn`, `useIsArray`, `useIterableCallbackReturn`, `useNamespaceKeyword`

Rules have Biome-like groups, severities, options and fix kinds, and most of the fixes are implemented.

## > how it works

- `@aljazmc/syntax` (`shared/syntax`): parses sources into syntax trees and walks them, shared with formatero
- `@aljazmc/config` (`shared/config`): loads `lintero.config.ts`, finds the files and matches `includes`, shared with every package
- `src/analysis/settings.ts`: resolves presets, domains, groups and rules to the enabled rules
- `src/analysis/semantic.ts`: scopes, bindings and references, telling types from values
- `src/analysis/flow.ts`: how statements complete, for unreachable code, fallthrough and returns
- `src/analysis/globals.ts`, `src/analysis/jsx.ts`, `src/analysis/nodes.ts`: global names and JSX and node helpers the rules share
- `src/rules`: one file per rule, visiting the nodes it checks in a single traversal
- `src/analysis/suppressions.ts`: suppression comments, reporting unused and malformed ones
