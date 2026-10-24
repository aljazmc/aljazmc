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
        // per group: a level for all of its rules (domain rules still follow their domains),
        // or a preset for the group and a level or configuration per rule
        // levels: "off" | "on" (the rule's severity) | "info" | "warn" | "error"
        suspicious: {
            preset: "all", // replaces the preset above for this group
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

- a11y (36): `noAccessKey`, `noAmbiguousAnchorText`, `noAriaHiddenOnFocusable`, `noAriaUnsupportedElements`, `noAutofocus`, `noDistractingElements`, `noHeaderScope`, `noInteractiveElementToNoninteractiveRole`, `noLabelWithoutControl`, `noNoninteractiveElementToInteractiveRole`, `noNoninteractiveTabindex`, `noPositiveTabindex`, `noRedundantAlt`, `noRedundantRoles`, `noStaticElementInteractions`, `noSvgWithoutTitle`, `useAltText`, `useAnchorContent`, `useAriaActivedescendantWithTabindex`, `useAriaPropsForRole`, `useAriaPropsSupportedByRole`, `useButtonType`, `useFocusableInteractive`, `useHeadingContent`, `useHtmlLang`, `useIframeTitle`, `useKeyWithClickEvents`, `useKeyWithMouseEvents`, `useMediaCaption`, `useSemanticElements`, `useValidAnchor`, `useValidAriaProps`, `useValidAriaRole`, `useValidAriaValues`, `useValidAutocomplete`, `useValidLang`
- complexity (34): `noAdjacentSpacesInRegex`, `noArguments`, `noBannedTypes`, `noCommaOperator`, `noEmptyTypeParameters`, `noExtraBooleanCast`, `noFlatMapIdentity`, `noStaticOnlyClass`, `noThisInStatic`, `noUselessCatch`, `noUselessConstructor`, `noUselessContinue`, `noUselessEmptyExport`, `noUselessEscapeInRegex`, `noUselessFragments`, `noUselessLabel`, `noUselessLoneBlockStatements`, `noUselessRename`, `noUselessStringRaw`, `noUselessSwitchCase`, `noUselessTernary`, `noUselessThisAlias`, `noUselessTypeConstraint`, `noUselessUndefinedInitialization`, `useArrowFunction`, `useDateNow`, `useFlatMap`, `useIndexOf`, `useLiteralKeys`, `useMathMinMax`, `useNumericLiterals`, `useOptionalChain`, `useRegexLiterals`, `useSimpleNumberKeys`
- correctness (56): `noChildrenProp`, `noComponentHookFactories`, `noConstantCondition`, `noConstantMathMinMaxClamp`, `noConstAssign`, `noConstructorReturn`, `noEmptyCharacterClassInRegex`, `noEmptyPattern`, `noGlobalObjectCalls`, `noInnerDeclarations`, `noInvalidBuiltinInstantiation`, `noInvalidConstructorSuper`, `noInvalidUseBeforeDeclaration`, `noJsxNamespace`, `noNonoctalDecimalEscape`, `noPlaywrightMissingAwait`, `noPrecisionLoss`, `noPrivateImports`, `noQwikUseVisibleTask`, `noReactNativeRawText`, `noRenderReturnValue`, `noSelfAssign`, `noSetterReturn`, `noStringCaseMismatch`, `noSwitchDeclarations`, `noUnreachable`, `noUnreachableSuper`, `noUnsafeFinally`, `noUnsafeOptionalChaining`, `noUnusedFunctionParameters`, `noUnusedImports`, `noUnusedLabels`, `noUnusedPrivateClassMembers`, `noUnusedVariables`, `noVoidElementsWithChildren`, `noVoidTypeReturn`, `noVueDataObjectDeclaration`, `noVueRefAsOperand`, `noVueReservedProps`, `useExhaustiveDependencies`, `useHookAtTopLevel`, `useImageSize`, `useInlineScriptId`, `useIsNan`, `useJsxKeyInIterable`, `useParseIntRadix`, `usePlaywrightValidDescribeCallback`, `useQwikClasslist`, `useQwikLoaderLocation`, `useQwikMethodUsage`, `useQwikValidLexicalScope`, `useReactAsyncServerFunction`, `useReactNativePlatformComponents`, `useValidForDirection`, `useValidTypeof`, `useYield`
- performance (6): `noAccumulatingSpread`, `noDynamicNamespaceImportAccess`, `noImgElement`, `noUnwantedPolyfillio`, `useDomNodeTextContent`, `useGoogleFontPreconnect`
- security (5): `noBlankTarget`, `noDangerouslySetInnerHtml`, `noDangerouslySetInnerHtmlWithChildren`, `noGlobalEval`, `noScriptUrl`
- style (12): `noHeadElement`, `noNonNullAssertion`, `useArrayLiterals`, `useConst`, `useExponentiationOperator`, `useExportType`, `useImportType`, `useLiteralEnumMembers`, `useNodejsImportProtocol`, `useShorthandFunctionType`, `useTemplate`, `useVueMultiWordComponentNames`
- suspicious (77): `noApproximativeNumericConstant`, `noArrayIndexKey`, `noAssignInExpressions`, `noAsyncPromiseExecutor`, `noBiomeFirstException`, `noCatchAssign`, `noClassAssign`, `noCommentText`, `noCompareNegZero`, `noConfusingLabels`, `noConfusingVoidType`, `noConstEnum`, `noControlCharactersInRegex`, `noDebugger`, `noDocumentCookie`, `noDocumentImportInPage`, `noDoubleEquals`, `noDrizzleDeleteWithoutWhere`, `noDrizzleUpdateWithoutWhere`, `noDuplicateCase`, `noDuplicateClassMembers`, `noDuplicateElseIf`, `noDuplicateEnumValues`, `noDuplicateJsxProps`, `noDuplicateObjectKeys`, `noDuplicateParameters`, `noDuplicateTestHooks`, `noEmptyInterface`, `noExplicitAny`, `noExportsInTest`, `noExtraNonNullAssertion`, `noFallthroughSwitchClause`, `noFocusedTests`, `noFunctionAssign`, `noGlobalAssign`, `noGlobalIsFinite`, `noGlobalIsNan`, `noHeadImportInDocument`, `noIdenticalTestTitle`, `noImplicitAnyLet`, `noImportAssign`, `noIrregularWhitespace`, `noLabelVar`, `noMisleadingCharacterClass`, `noMisleadingInstantiator`, `noMisrefactoredShorthandAssign`, `noNonNullAssertedOptionalChain`, `noOctalEscape`, `noProto`, `noPrototypeBuiltins`, `noQuickfixBiome`, `noReactNativeDeepImports`, `noReactSpecificProps`, `noReactStringRefs`, `noRedeclare`, `noRedundantUseStrict`, `noSelfCompare`, `noShadowRestrictedNames`, `noSparseArray`, `noSuspiciousSemicolonInJsx`, `noTemplateCurlyInString`, `noThenProperty`, `noTsIgnore`, `noUndeclaredEnvVars`, `noUnsafeDeclarationMerging`, `noUnsafeNegation`, `noUselessEscapeInString`, `noUselessRegexBackrefs`, `noWith`, `useAdjacentOverloadSignatures`, `useBiomeIgnoreFolder`, `useDefaultSwitchClauseLast`, `useGetterReturn`, `useGoogleFontDisplay`, `useIsArray`, `useIterableCallbackReturn`, `useNamespaceKeyword`

Rules have Biome-like groups, severities, options, domains and fix kinds, and most of the fixes are implemented. Rules of the `react`, `next`, `qwik`, `solid`, `vue`, `test`, `playwright`, `drizzle`, `reactNative` and `turborepo` domains are enabled by the dependencies in `package.json`, like in Biome; `project` rules like `noPrivateImports` only when enabled in `domains`, since they read the files a module imports. `noUndeclaredEnvVars` reads `turbo.json`.

## > how it works

- `@aljazmc/syntax` (`shared/syntax`): parses sources into syntax trees and walks them, shared with formatero
- `@aljazmc/config` (`shared/config`): loads `lintero.config.ts`, finds the files and matches `includes`, shared with every package
- `src/analysis/settings.ts`: resolves presets, domains, groups and rules to the enabled rules
- `src/analysis/semantic.ts`: scopes, bindings and references, telling types from values
- `src/analysis/flow.ts`: how statements complete, for unreachable code, fallthrough and returns
- `src/analysis/globals.ts`, `src/analysis/jsx.ts`, `src/analysis/nodes.ts`: global names and JSX and node helpers the rules share
- `src/rules`: one file per rule, visiting the nodes it checks in a single traversal
- `src/analysis/suppressions.ts`: suppression comments, reporting unused and malformed ones, also limited to instances like `useExhaustiveDependencies(a)`
- `src/analysis/aria.ts`, `src/analysis/regex.ts`: ARIA roles, attributes and the roles of elements, and a parser for regular expression literals
- `src/analysis/react.ts`, `src/analysis/tests.ts`, `src/analysis/vue.ts`: React, test framework and Vue calls, recognized like Biome
