import type { Rule } from "../rules.js";
import noAccessKey from "./a11y/no-access-key.js";
import noAmbiguousAnchorText from "./a11y/no-ambiguous-anchor-text.js";
import noAriaHiddenOnFocusable from "./a11y/no-aria-hidden-on-focusable.js";
import noAriaUnsupportedElements from "./a11y/no-aria-unsupported-elements.js";
import noAutofocus from "./a11y/no-autofocus.js";
import noDistractingElements from "./a11y/no-distracting-elements.js";
import noHeaderScope from "./a11y/no-header-scope.js";
import noInteractiveElementToNoninteractiveRole from "./a11y/no-interactive-element-to-noninteractive-role.js";
import noLabelWithoutControl from "./a11y/no-label-without-control.js";
/** Every rule lintero implements, by group. */
import noNoninteractiveElementInteractions from "./a11y/no-noninteractive-element-interactions.js";
import noNoninteractiveElementToInteractiveRole from "./a11y/no-noninteractive-element-to-interactive-role.js";
import noNoninteractiveTabindex from "./a11y/no-noninteractive-tabindex.js";
import noPositiveTabindex from "./a11y/no-positive-tabindex.js";
import noRedundantAlt from "./a11y/no-redundant-alt.js";
import noRedundantRoles from "./a11y/no-redundant-roles.js";
import noStaticElementInteractions from "./a11y/no-static-element-interactions.js";
import noSvgWithoutTitle from "./a11y/no-svg-without-title.js";
import useAltText from "./a11y/use-alt-text.js";
import useAnchorContent from "./a11y/use-anchor-content.js";
import useAriaActivedescendantWithTabindex from "./a11y/use-aria-activedescendant-with-tabindex.js";
import useAriaPropsForRole from "./a11y/use-aria-props-for-role.js";
import useAriaPropsSupportedByRole from "./a11y/use-aria-props-supported-by-role.js";
import useButtonType from "./a11y/use-button-type.js";
import useFocusableInteractive from "./a11y/use-focusable-interactive.js";
import useGenericFontNames from "./a11y/use-generic-font-names.js";
import useHeadingContent from "./a11y/use-heading-content.js";
import useHtmlLang from "./a11y/use-html-lang.js";
import useIframeTitle from "./a11y/use-iframe-title.js";
import useKeyWithClickEvents from "./a11y/use-key-with-click-events.js";
import useKeyWithMouseEvents from "./a11y/use-key-with-mouse-events.js";
import useMediaCaption from "./a11y/use-media-caption.js";
import useSemanticElements from "./a11y/use-semantic-elements.js";
import useValidAnchor from "./a11y/use-valid-anchor.js";
import useValidAriaProps from "./a11y/use-valid-aria-props.js";
import useValidAriaRole from "./a11y/use-valid-aria-role.js";
import useValidAriaValues from "./a11y/use-valid-aria-values.js";
import useValidAutocomplete from "./a11y/use-valid-autocomplete.js";
import useValidLang from "./a11y/use-valid-lang.js";
import noAdjacentSpacesInRegex from "./complexity/no-adjacent-spaces-in-regex.js";
import noArguments from "./complexity/no-arguments.js";
import noBannedTypes from "./complexity/no-banned-types.js";
import noCommaOperator from "./complexity/no-comma-operator.js";
import noEmptyTypeParameters from "./complexity/no-empty-type-parameters.js";
import noExcessiveSelectorClasses from "./complexity/no-excessive-selector-classes.js";
import noExtraBooleanCast from "./complexity/no-extra-boolean-cast.js";
import noFlatMapIdentity from "./complexity/no-flat-map-identity.js";
import noImportantStyles from "./complexity/no-important-styles.js";
import noStaticOnlyClass from "./complexity/no-static-only-class.js";
import noThisInStatic from "./complexity/no-this-in-static.js";
import noUselessCatch from "./complexity/no-useless-catch.js";
import noUselessConstructor from "./complexity/no-useless-constructor.js";
import noUselessContinue from "./complexity/no-useless-continue.js";
import noUselessEmptyExport from "./complexity/no-useless-empty-export.js";
import noUselessEscapeInRegex from "./complexity/no-useless-escape-in-regex.js";
import noUselessFragments from "./complexity/no-useless-fragments.js";
import noUselessLabel from "./complexity/no-useless-label.js";
import noUselessLoneBlockStatements from "./complexity/no-useless-lone-block-statements.js";
import noUselessRename from "./complexity/no-useless-rename.js";
import noUselessStringRaw from "./complexity/no-useless-string-raw.js";
import noUselessSwitchCase from "./complexity/no-useless-switch-case.js";
import noUselessTernary from "./complexity/no-useless-ternary.js";
import noUselessThisAlias from "./complexity/no-useless-this-alias.js";
import noUselessTypeConstraint from "./complexity/no-useless-type-constraint.js";
import noUselessUndefinedInitialization from "./complexity/no-useless-undefined-initialization.js";
import useArrowFunction from "./complexity/use-arrow-function.js";
import useDateNow from "./complexity/use-date-now.js";
import useFlatMap from "./complexity/use-flat-map.js";
import useIndexOf from "./complexity/use-index-of.js";
import useLiteralKeys from "./complexity/use-literal-keys.js";
import useMathMinMax from "./complexity/use-math-min-max.js";
import useNumericLiterals from "./complexity/use-numeric-literals.js";
import useOptionalChain from "./complexity/use-optional-chain.js";
import useRegexLiterals from "./complexity/use-regex-literals.js";
import useSimpleNumberKeys from "./complexity/use-simple-number-keys.js";
import noChildrenProp from "./correctness/no-children-prop.js";
import noComponentHookFactories from "./correctness/no-component-hook-factories.js";
import noConstAssign from "./correctness/no-const-assign.js";
import noConstantCondition from "./correctness/no-constant-condition.js";
import noConstantMathMinMaxClamp from "./correctness/no-constant-math-min-max-clamp.js";
import noConstructorReturn from "./correctness/no-constructor-return.js";
import noDuplicateAttributes from "./correctness/no-duplicate-attributes.js";
import noEmptyCharacterClassInRegex from "./correctness/no-empty-character-class-in-regex.js";
import noEmptyPattern from "./correctness/no-empty-pattern.js";
import noGlobalObjectCalls from "./correctness/no-global-object-calls.js";
import noInnerDeclarations from "./correctness/no-inner-declarations.js";
import noInvalidBuiltinInstantiation from "./correctness/no-invalid-builtin-instantiation.js";
import noInvalidConstructorSuper from "./correctness/no-invalid-constructor-super.js";
import noInvalidDirectionInLinearGradient from "./correctness/no-invalid-direction-in-linear-gradient.js";
import noInvalidGridAreas from "./correctness/no-invalid-grid-areas.js";
import noInvalidPositionAtImportRule from "./correctness/no-invalid-position-at-import-rule.js";
import noInvalidUseBeforeDeclaration from "./correctness/no-invalid-use-before-declaration.js";
import noJsxNamespace from "./correctness/no-jsx-namespace.js";
import noMissingVarFunction from "./correctness/no-missing-var-function.js";
import noNonoctalDecimalEscape from "./correctness/no-nonoctal-decimal-escape.js";
import noPlaywrightMissingAwait from "./correctness/no-playwright-missing-await.js";
import noPrecisionLoss from "./correctness/no-precision-loss.js";
import noPrivateImports from "./correctness/no-private-imports.js";
import noQwikUseVisibleTask from "./correctness/no-qwik-use-visible-task.js";
import noReactNativeRawText from "./correctness/no-react-native-raw-text.js";
import noRenderReturnValue from "./correctness/no-render-return-value.js";
import noRestrictedElements from "./correctness/no-restricted-elements.js";
import noSelfAssign from "./correctness/no-self-assign.js";
import noSetterReturn from "./correctness/no-setter-return.js";
import noStringCaseMismatch from "./correctness/no-string-case-mismatch.js";
import noSwitchDeclarations from "./correctness/no-switch-declarations.js";
import noUnknownFunction from "./correctness/no-unknown-function.js";
import noUnknownMediaFeatureName from "./correctness/no-unknown-media-feature-name.js";
import noUnknownProperty from "./correctness/no-unknown-property.js";
import noUnknownPseudoClass from "./correctness/no-unknown-pseudo-class.js";
import noUnknownPseudoElement from "./correctness/no-unknown-pseudo-element.js";
import noUnknownTypeSelector from "./correctness/no-unknown-type-selector.js";
import noUnknownUnit from "./correctness/no-unknown-unit.js";
import noUnmatchableAnbSelector from "./correctness/no-unmatchable-anb-selector.js";
import noUnreachable from "./correctness/no-unreachable.js";
import noUnreachableSuper from "./correctness/no-unreachable-super.js";
import noUnsafeFinally from "./correctness/no-unsafe-finally.js";
import noUnsafeOptionalChaining from "./correctness/no-unsafe-optional-chaining.js";
import noUnusedFunctionParameters from "./correctness/no-unused-function-parameters.js";
import noUnusedImports from "./correctness/no-unused-imports.js";
import noUnusedLabels from "./correctness/no-unused-labels.js";
import noUnusedPrivateClassMembers from "./correctness/no-unused-private-class-members.js";
import noUnusedVariables from "./correctness/no-unused-variables.js";
import noVoidElementsWithChildren from "./correctness/no-void-elements-with-children.js";
import noVoidTypeReturn from "./correctness/no-void-type-return.js";
import noVueDataObjectDeclaration from "./correctness/no-vue-data-object-declaration.js";
import noVueRefAsOperand from "./correctness/no-vue-ref-as-operand.js";
import noVueReservedProps from "./correctness/no-vue-reserved-props.js";
import useExhaustiveDependencies from "./correctness/use-exhaustive-dependencies.js";
import useHookAtTopLevel from "./correctness/use-hook-at-top-level.js";
import useImageSize from "./correctness/use-image-size.js";
import useInlineScriptId from "./correctness/use-inline-script-id.js";
import useIsNan from "./correctness/use-is-nan.js";
import useJsxKeyInIterable from "./correctness/use-jsx-key-in-iterable.js";
import useParseIntRadix from "./correctness/use-parse-int-radix.js";
import usePlaywrightValidDescribeCallback from "./correctness/use-playwright-valid-describe-callback.js";
import useQwikClasslist from "./correctness/use-qwik-classlist.js";
import useQwikLoaderLocation from "./correctness/use-qwik-loader-location.js";
import useQwikMethodUsage from "./correctness/use-qwik-method-usage.js";
import useQwikValidLexicalScope from "./correctness/use-qwik-valid-lexical-scope.js";
import useReactAsyncServerFunction from "./correctness/use-react-async-server-function.js";
import useReactNativePlatformComponents from "./correctness/use-react-native-platform-components.js";
import useValidForDirection from "./correctness/use-valid-for-direction.js";
import useValidTypeof from "./correctness/use-valid-typeof.js";
import useYield from "./correctness/use-yield.js";
import noInvalidFileInputAccept from "./nursery/no-invalid-file-input-accept.js";
import noMisplacedListElements from "./nursery/no-misplaced-list-elements.js";
import noNonScalableViewport from "./nursery/no-non-scalable-viewport.js";
import noObsoleteAttributes from "./nursery/no-obsolete-attributes.js";
import noObsoleteTags from "./nursery/no-obsolete-tags.js";
import noSelfNestedLayer from "./nursery/no-self-nested-layer.js";
import noShortTimeValues from "./nursery/no-short-time-values.js";
import noUndeclaredCustomProperties from "./nursery/no-undeclared-custom-properties.js";
import noUnsafeIframeSandbox from "./nursery/no-unsafe-iframe-sandbox.js";
import noUnusedClasses from "./nursery/no-unused-classes.js";
import noZeroLengthUnit from "./nursery/no-zero-length-unit.js";
import useConsistentHeadingLevel from "./nursery/use-consistent-heading-level.js";
import useConsistentLightnessNotation from "./nursery/use-consistent-lightness-notation.js";
import useConsistentUnicodeBom from "./nursery/use-consistent-unicode-bom.js";
import useControlLabel from "./nursery/use-control-label.js";
import useFencedCodeLanguage from "./nursery/use-fenced-code-language.js";
import useLayeredStyles from "./nursery/use-layered-styles.js";
import useLogicalProperties from "./nursery/use-logical-properties.js";
import useNamedLayer from "./nursery/use-named-layer.js";
import useSingleTopLevelHeading from "./nursery/use-single-top-level-heading.js";
import useTopLevelHeading from "./nursery/use-top-level-heading.js";
import noAccumulatingSpread from "./performance/no-accumulating-spread.js";
import noDynamicNamespaceImportAccess from "./performance/no-dynamic-namespace-import-access.js";
import noImgElement from "./performance/no-img-element.js";
import noSyncScripts from "./performance/no-sync-scripts.js";
import noUnwantedPolyfillio from "./performance/no-unwanted-polyfillio.js";
import useDomNodeTextContent from "./performance/use-dom-node-text-content.js";
import useGoogleFontPreconnect from "./performance/use-google-font-preconnect.js";
import noBlankTarget from "./security/no-blank-target.js";
import noDangerouslySetInnerHtml from "./security/no-dangerously-set-inner-html.js";
import noDangerouslySetInnerHtmlWithChildren from "./security/no-dangerously-set-inner-html-with-children.js";
import noGlobalEval from "./security/no-global-eval.js";
import noScriptUrl from "./security/no-script-url.js";
import useIframeSandbox from "./security/use-iframe-sandbox.js";
import noDescendingSpecificity from "./style/no-descending-specificity.js";
import noExcessiveLinesPerFile from "./style/no-excessive-lines-per-file.js";
import noHeadElement from "./style/no-head-element.js";
import noHexColors from "./style/no-hex-colors.js";
import noInlineStyles from "./style/no-inline-styles.js";
import noNonNullAssertion from "./style/no-non-null-assertion.js";
import noValueAtRule from "./style/no-value-at-rule.js";
import useArrayLiterals from "./style/use-array-literals.js";
import useConst from "./style/use-const.js";
import useExponentiationOperator from "./style/use-exponentiation-operator.js";
import useExportType from "./style/use-export-type.js";
import useImportType from "./style/use-import-type.js";
import useLiteralEnumMembers from "./style/use-literal-enum-members.js";
import useNodejsImportProtocol from "./style/use-nodejs-import-protocol.js";
import useShorthandFunctionType from "./style/use-shorthand-function-type.js";
import useTemplate from "./style/use-template.js";
import useVueMultiWordComponentNames from "./style/use-vue-multi-word-component-names.js";
import noApproximativeNumericConstant from "./suspicious/no-approximative-numeric-constant.js";
import noArrayIndexKey from "./suspicious/no-array-index-key.js";
import noAssignInExpressions from "./suspicious/no-assign-in-expressions.js";
import noAsyncPromiseExecutor from "./suspicious/no-async-promise-executor.js";
import noBiomeFirstException from "./suspicious/no-biome-first-exception.js";
import noCatchAssign from "./suspicious/no-catch-assign.js";
import noClassAssign from "./suspicious/no-class-assign.js";
import noCommentText from "./suspicious/no-comment-text.js";
import noCompareNegZero from "./suspicious/no-compare-neg-zero.js";
import noConfusingLabels from "./suspicious/no-confusing-labels.js";
import noConfusingVoidType from "./suspicious/no-confusing-void-type.js";
import noConstEnum from "./suspicious/no-const-enum.js";
import noControlCharactersInRegex from "./suspicious/no-control-characters-in-regex.js";
import noDebugger from "./suspicious/no-debugger.js";
import noDeprecatedMediaType from "./suspicious/no-deprecated-media-type.js";
import noDocumentCookie from "./suspicious/no-document-cookie.js";
import noDocumentImportInPage from "./suspicious/no-document-import-in-page.js";
import noDoubleEquals from "./suspicious/no-double-equals.js";
import noDrizzleDeleteWithoutWhere from "./suspicious/no-drizzle-delete-without-where.js";
import noDrizzleUpdateWithoutWhere from "./suspicious/no-drizzle-update-without-where.js";
import noDuplicateAtImportRules from "./suspicious/no-duplicate-at-import-rules.js";
import noDuplicateCase from "./suspicious/no-duplicate-case.js";
import noDuplicateClassMembers from "./suspicious/no-duplicate-class-members.js";
import noDuplicateCustomProperties from "./suspicious/no-duplicate-custom-properties.js";
import noDuplicateElseIf from "./suspicious/no-duplicate-else-if.js";
import noDuplicateEnumValues from "./suspicious/no-duplicate-enum-values.js";
import noDuplicateFontNames from "./suspicious/no-duplicate-font-names.js";
import noDuplicateJsxProps from "./suspicious/no-duplicate-jsx-props.js";
import noDuplicateObjectKeys from "./suspicious/no-duplicate-object-keys.js";
import noDuplicateParameters from "./suspicious/no-duplicate-parameters.js";
import noDuplicateProperties from "./suspicious/no-duplicate-properties.js";
import noDuplicateSelectors from "./suspicious/no-duplicate-selectors.js";
import noDuplicateSelectorsKeyframeBlock from "./suspicious/no-duplicate-selectors-keyframe-block.js";
import noDuplicateTestHooks from "./suspicious/no-duplicate-test-hooks.js";
import noEmptyBlock from "./suspicious/no-empty-block.js";
import noEmptyInterface from "./suspicious/no-empty-interface.js";
import noEmptySource from "./suspicious/no-empty-source.js";
import noExplicitAny from "./suspicious/no-explicit-any.js";
import noExportsInTest from "./suspicious/no-exports-in-test.js";
import noExtraNonNullAssertion from "./suspicious/no-extra-non-null-assertion.js";
import noFallthroughSwitchClause from "./suspicious/no-fallthrough-switch-clause.js";
import noFocusedTests from "./suspicious/no-focused-tests.js";
import noFunctionAssign from "./suspicious/no-function-assign.js";
import noGlobalAssign from "./suspicious/no-global-assign.js";
import noGlobalIsFinite from "./suspicious/no-global-is-finite.js";
import noGlobalIsNan from "./suspicious/no-global-is-nan.js";
import noHeadImportInDocument from "./suspicious/no-head-import-in-document.js";
import noIdenticalTestTitle from "./suspicious/no-identical-test-title.js";
import noImplicitAnyLet from "./suspicious/no-implicit-any-let.js";
import noImportAssign from "./suspicious/no-import-assign.js";
import noImportantInKeyframe from "./suspicious/no-important-in-keyframe.js";
import noIrregularWhitespace from "./suspicious/no-irregular-whitespace.js";
import noLabelVar from "./suspicious/no-label-var.js";
import noMisleadingCharacterClass from "./suspicious/no-misleading-character-class.js";
import noMisleadingInstantiator from "./suspicious/no-misleading-instantiator.js";
import noMisrefactoredShorthandAssign from "./suspicious/no-misrefactored-shorthand-assign.js";
import noNonNullAssertedOptionalChain from "./suspicious/no-non-null-asserted-optional-chain.js";
import noOctalEscape from "./suspicious/no-octal-escape.js";
import noProto from "./suspicious/no-proto.js";
import noPrototypeBuiltins from "./suspicious/no-prototype-builtins.js";
import noQuickfixBiome from "./suspicious/no-quickfix-biome.js";
import noReactNativeDeepImports from "./suspicious/no-react-native-deep-imports.js";
import noReactSpecificProps from "./suspicious/no-react-specific-props.js";
import noReactStringRefs from "./suspicious/no-react-string-refs.js";
import noRedeclare from "./suspicious/no-redeclare.js";
import noRedundantUseStrict from "./suspicious/no-redundant-use-strict.js";
import noSelfCompare from "./suspicious/no-self-compare.js";
import noShadowRestrictedNames from "./suspicious/no-shadow-restricted-names.js";
import noShorthandPropertyOverrides from "./suspicious/no-shorthand-property-overrides.js";
import noSparseArray from "./suspicious/no-sparse-array.js";
import noSuspiciousSemicolonInJsx from "./suspicious/no-suspicious-semicolon-in-jsx.js";
import noTemplateCurlyInString from "./suspicious/no-template-curly-in-string.js";
import noThenProperty from "./suspicious/no-then-property.js";
import noTsIgnore from "./suspicious/no-ts-ignore.js";
import noUndeclaredEnvVars from "./suspicious/no-undeclared-env-vars.js";
import noUnknownAtRules from "./suspicious/no-unknown-at-rules.js";
import noUnsafeDeclarationMerging from "./suspicious/no-unsafe-declaration-merging.js";
import noUnsafeNegation from "./suspicious/no-unsafe-negation.js";
import noUselessEscapeInString from "./suspicious/no-useless-escape-in-string.js";
import noUselessRegexBackrefs from "./suspicious/no-useless-regex-backrefs.js";
import noWith from "./suspicious/no-with.js";
import useAdjacentOverloadSignatures from "./suspicious/use-adjacent-overload-signatures.js";
import useBaseline from "./suspicious/use-baseline.js";
import useBiomeIgnoreFolder from "./suspicious/use-biome-ignore-folder.js";
import useDefaultSwitchClauseLast from "./suspicious/use-default-switch-clause-last.js";
import useGetterReturn from "./suspicious/use-getter-return.js";
import useGoogleFontDisplay from "./suspicious/use-google-font-display.js";
import useIsArray from "./suspicious/use-is-array.js";
import useIterableCallbackReturn from "./suspicious/use-iterable-callback-return.js";
import useNamespaceKeyword from "./suspicious/use-namespace-keyword.js";

export default [
    noAccessKey,
    noAmbiguousAnchorText,
    noAriaHiddenOnFocusable,
    noAriaUnsupportedElements,
    noAutofocus,
    noDistractingElements,
    noHeaderScope,
    noInteractiveElementToNoninteractiveRole,
    noLabelWithoutControl,
    noNoninteractiveElementInteractions,
    noNoninteractiveElementToInteractiveRole,
    noNoninteractiveTabindex,
    noPositiveTabindex,
    noRedundantAlt,
    noRedundantRoles,
    noStaticElementInteractions,
    noSvgWithoutTitle,
    useAltText,
    useAnchorContent,
    useAriaActivedescendantWithTabindex,
    useAriaPropsForRole,
    useAriaPropsSupportedByRole,
    useButtonType,
    useFocusableInteractive,
    useHeadingContent,
    useHtmlLang,
    useIframeTitle,
    useKeyWithClickEvents,
    useKeyWithMouseEvents,
    useMediaCaption,
    useSemanticElements,
    useValidAnchor,
    useValidAriaProps,
    useValidAriaRole,
    useValidAriaValues,
    useValidAutocomplete,
    useValidLang,
    noAdjacentSpacesInRegex,
    noArguments,
    noBannedTypes,
    noCommaOperator,
    noEmptyTypeParameters,
    noExtraBooleanCast,
    noFlatMapIdentity,
    noStaticOnlyClass,
    noThisInStatic,
    noUselessCatch,
    noUselessConstructor,
    noUselessContinue,
    noUselessEmptyExport,
    noUselessEscapeInRegex,
    noUselessFragments,
    noUselessLabel,
    noUselessLoneBlockStatements,
    noUselessRename,
    noUselessStringRaw,
    noUselessSwitchCase,
    noUselessTernary,
    noUselessThisAlias,
    noUselessTypeConstraint,
    noUselessUndefinedInitialization,
    useArrowFunction,
    useDateNow,
    useFlatMap,
    useIndexOf,
    useLiteralKeys,
    useMathMinMax,
    useNumericLiterals,
    useOptionalChain,
    useRegexLiterals,
    useSimpleNumberKeys,
    noChildrenProp,
    noComponentHookFactories,
    noConstAssign,
    noConstantCondition,
    noConstantMathMinMaxClamp,
    noConstructorReturn,
    noDuplicateAttributes,
    noEmptyCharacterClassInRegex,
    noEmptyPattern,
    noGlobalObjectCalls,
    noInnerDeclarations,
    noInvalidBuiltinInstantiation,
    noInvalidConstructorSuper,
    noInvalidUseBeforeDeclaration,
    noJsxNamespace,
    noNonoctalDecimalEscape,
    noPlaywrightMissingAwait,
    noPrecisionLoss,
    noPrivateImports,
    noQwikUseVisibleTask,
    noReactNativeRawText,
    noRenderReturnValue,
    noRestrictedElements,
    noSelfAssign,
    noSetterReturn,
    noStringCaseMismatch,
    noSwitchDeclarations,
    noUnreachable,
    noUnreachableSuper,
    noUnsafeFinally,
    noUnsafeOptionalChaining,
    noUnusedFunctionParameters,
    noUnusedImports,
    noUnusedLabels,
    noUnusedPrivateClassMembers,
    noUnusedVariables,
    noVoidElementsWithChildren,
    noVoidTypeReturn,
    noVueDataObjectDeclaration,
    noVueRefAsOperand,
    noVueReservedProps,
    useExhaustiveDependencies,
    useHookAtTopLevel,
    useImageSize,
    useInlineScriptId,
    useIsNan,
    useJsxKeyInIterable,
    useParseIntRadix,
    usePlaywrightValidDescribeCallback,
    useQwikClasslist,
    useQwikLoaderLocation,
    useQwikMethodUsage,
    useQwikValidLexicalScope,
    useReactAsyncServerFunction,
    useReactNativePlatformComponents,
    useValidForDirection,
    useValidTypeof,
    useYield,
    noInvalidFileInputAccept,
    noMisplacedListElements,
    noNonScalableViewport,
    noObsoleteAttributes,
    noObsoleteTags,
    noUnsafeIframeSandbox,
    useConsistentHeadingLevel,
    useConsistentUnicodeBom,
    useControlLabel,
    useFencedCodeLanguage,
    useSingleTopLevelHeading,
    useTopLevelHeading,
    noAccumulatingSpread,
    noDynamicNamespaceImportAccess,
    noImgElement,
    noSyncScripts,
    noUnwantedPolyfillio,
    useDomNodeTextContent,
    useGoogleFontPreconnect,
    noBlankTarget,
    noDangerouslySetInnerHtml,
    noDangerouslySetInnerHtmlWithChildren,
    noGlobalEval,
    noScriptUrl,
    useIframeSandbox,
    noExcessiveLinesPerFile,
    noHeadElement,
    noInlineStyles,
    noNonNullAssertion,
    useArrayLiterals,
    useConst,
    useExponentiationOperator,
    useExportType,
    useImportType,
    useLiteralEnumMembers,
    useNodejsImportProtocol,
    useShorthandFunctionType,
    useTemplate,
    useVueMultiWordComponentNames,
    noApproximativeNumericConstant,
    noArrayIndexKey,
    noAssignInExpressions,
    noAsyncPromiseExecutor,
    noBiomeFirstException,
    noCatchAssign,
    noClassAssign,
    noCommentText,
    noCompareNegZero,
    noConfusingLabels,
    noConfusingVoidType,
    noConstEnum,
    noControlCharactersInRegex,
    noDebugger,
    noDocumentCookie,
    noDocumentImportInPage,
    noDoubleEquals,
    noDrizzleDeleteWithoutWhere,
    noDrizzleUpdateWithoutWhere,
    noDuplicateCase,
    noDuplicateClassMembers,
    noDuplicateElseIf,
    noDuplicateEnumValues,
    noDuplicateJsxProps,
    noDuplicateObjectKeys,
    noDuplicateParameters,
    noDuplicateTestHooks,
    noEmptyInterface,
    noEmptySource,
    noExplicitAny,
    noExportsInTest,
    noExtraNonNullAssertion,
    noFallthroughSwitchClause,
    noFocusedTests,
    noFunctionAssign,
    noGlobalAssign,
    noGlobalIsFinite,
    noGlobalIsNan,
    noHeadImportInDocument,
    noIdenticalTestTitle,
    noImplicitAnyLet,
    noImportAssign,
    noIrregularWhitespace,
    noLabelVar,
    noMisleadingCharacterClass,
    noMisleadingInstantiator,
    noMisrefactoredShorthandAssign,
    noNonNullAssertedOptionalChain,
    noOctalEscape,
    noProto,
    noPrototypeBuiltins,
    noQuickfixBiome,
    noReactNativeDeepImports,
    noReactSpecificProps,
    noReactStringRefs,
    noRedeclare,
    noRedundantUseStrict,
    noSelfCompare,
    noShadowRestrictedNames,
    noSparseArray,
    noSuspiciousSemicolonInJsx,
    noTemplateCurlyInString,
    noThenProperty,
    noTsIgnore,
    noUndeclaredEnvVars,
    noUnsafeDeclarationMerging,
    noUnsafeNegation,
    noUselessEscapeInString,
    noUselessRegexBackrefs,
    noWith,
    useAdjacentOverloadSignatures,
    useBiomeIgnoreFolder,
    useDefaultSwitchClauseLast,
    useGetterReturn,
    useGoogleFontDisplay,
    useIsArray,
    useIterableCallbackReturn,
    useNamespaceKeyword,
    noHexColors,
    noValueAtRule,
    noEmptyBlock,
    useNamedLayer,
    noDuplicateSelectorsKeyframeBlock,
    noImportantInKeyframe,
    noImportantStyles,
    noUnknownAtRules,
    noDuplicateProperties,
    noDuplicateCustomProperties,
    noUnknownTypeSelector,
    noDuplicateFontNames,
    useGenericFontNames,
    noDuplicateAtImportRules,
    noDeprecatedMediaType,
    noInvalidPositionAtImportRule,
    noUnknownPseudoClass,
    noUnknownPseudoElement,
    noUnmatchableAnbSelector,
    noExcessiveSelectorClasses,
    noUnknownProperty,
    noUnknownFunction,
    noUnknownMediaFeatureName,
    noUnknownUnit,
    useLayeredStyles,
    noSelfNestedLayer,
    noShorthandPropertyOverrides,
    noInvalidDirectionInLinearGradient,
    noMissingVarFunction,
    noShortTimeValues,
    noZeroLengthUnit,
    useConsistentLightnessNotation,
    noInvalidGridAreas,
    noUndeclaredCustomProperties,
    noUnusedClasses,
    noDescendingSpecificity,
    noDuplicateSelectors,
    useLogicalProperties,
    useBaseline,
] as Rule[];
