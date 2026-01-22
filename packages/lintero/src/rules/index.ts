import type { Rule } from "../rules.js";
import noAccessKey from "./a11y/no-access-key.js";
import noAriaHiddenOnFocusable from "./a11y/no-aria-hidden-on-focusable.js";
import noAutofocus from "./a11y/no-autofocus.js";
import noDistractingElements from "./a11y/no-distracting-elements.js";
import noHeaderScope from "./a11y/no-header-scope.js";
import noPositiveTabindex from "./a11y/no-positive-tabindex.js";
import noRedundantAlt from "./a11y/no-redundant-alt.js";
import noSvgWithoutTitle from "./a11y/no-svg-without-title.js";
import useAltText from "./a11y/use-alt-text.js";
import useAnchorContent from "./a11y/use-anchor-content.js";
import useButtonType from "./a11y/use-button-type.js";
import useHeadingContent from "./a11y/use-heading-content.js";
import useHtmlLang from "./a11y/use-html-lang.js";
import useIframeTitle from "./a11y/use-iframe-title.js";
import useKeyWithClickEvents from "./a11y/use-key-with-click-events.js";
import useKeyWithMouseEvents from "./a11y/use-key-with-mouse-events.js";
import useMediaCaption from "./a11y/use-media-caption.js";
import noAdjacentSpacesInRegex from "./complexity/no-adjacent-spaces-in-regex.js";
import noArguments from "./complexity/no-arguments.js";
import noBannedTypes from "./complexity/no-banned-types.js";
import noCommaOperator from "./complexity/no-comma-operator.js";
import noEmptyTypeParameters from "./complexity/no-empty-type-parameters.js";
import noExtraBooleanCast from "./complexity/no-extra-boolean-cast.js";
import noFlatMapIdentity from "./complexity/no-flat-map-identity.js";
import noStaticOnlyClass from "./complexity/no-static-only-class.js";
import noThisInStatic from "./complexity/no-this-in-static.js";
import noUselessCatch from "./complexity/no-useless-catch.js";
import noUselessConstructor from "./complexity/no-useless-constructor.js";
import noUselessContinue from "./complexity/no-useless-continue.js";
import noUselessEmptyExport from "./complexity/no-useless-empty-export.js";
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
import useNumericLiterals from "./complexity/use-numeric-literals.js";
import useRegexLiterals from "./complexity/use-regex-literals.js";
import useSimpleNumberKeys from "./complexity/use-simple-number-keys.js";
import noConstAssign from "./correctness/no-const-assign.js";
import noConstantCondition from "./correctness/no-constant-condition.js";
import noConstantMathMinMaxClamp from "./correctness/no-constant-math-min-max-clamp.js";
import noConstructorReturn from "./correctness/no-constructor-return.js";
import noEmptyCharacterClassInRegex from "./correctness/no-empty-character-class-in-regex.js";
import noEmptyPattern from "./correctness/no-empty-pattern.js";
import noGlobalObjectCalls from "./correctness/no-global-object-calls.js";
import noInnerDeclarations from "./correctness/no-inner-declarations.js";
import noInvalidBuiltinInstantiation from "./correctness/no-invalid-builtin-instantiation.js";
import noInvalidConstructorSuper from "./correctness/no-invalid-constructor-super.js";
import noInvalidUseBeforeDeclaration from "./correctness/no-invalid-use-before-declaration.js";
import noNonoctalDecimalEscape from "./correctness/no-nonoctal-decimal-escape.js";
import noPrecisionLoss from "./correctness/no-precision-loss.js";
import noSelfAssign from "./correctness/no-self-assign.js";
import noSetterReturn from "./correctness/no-setter-return.js";
import noStringCaseMismatch from "./correctness/no-string-case-mismatch.js";
import noSwitchDeclarations from "./correctness/no-switch-declarations.js";
import noUnreachable from "./correctness/no-unreachable.js";
import noUnsafeFinally from "./correctness/no-unsafe-finally.js";
import noUnsafeOptionalChaining from "./correctness/no-unsafe-optional-chaining.js";
import noUnusedFunctionParameters from "./correctness/no-unused-function-parameters.js";
import noUnusedImports from "./correctness/no-unused-imports.js";
import noUnusedLabels from "./correctness/no-unused-labels.js";
import noUnusedPrivateClassMembers from "./correctness/no-unused-private-class-members.js";
import noUnusedVariables from "./correctness/no-unused-variables.js";
import noVoidElementsWithChildren from "./correctness/no-void-elements-with-children.js";
import noVoidTypeReturn from "./correctness/no-void-type-return.js";
import useIsNan from "./correctness/use-is-nan.js";
import useParseIntRadix from "./correctness/use-parse-int-radix.js";
import useValidForDirection from "./correctness/use-valid-for-direction.js";
import useValidTypeof from "./correctness/use-valid-typeof.js";
import useYield from "./correctness/use-yield.js";
import noAccumulatingSpread from "./performance/no-accumulating-spread.js";
import noDynamicNamespaceImportAccess from "./performance/no-dynamic-namespace-import-access.js";
import noBlankTarget from "./security/no-blank-target.js";
import noGlobalEval from "./security/no-global-eval.js";
import noScriptUrl from "./security/no-script-url.js";
import noNonNullAssertion from "./style/no-non-null-assertion.js";
import useArrayLiterals from "./style/use-array-literals.js";
import useConst from "./style/use-const.js";
import useExponentiationOperator from "./style/use-exponentiation-operator.js";
import useExportType from "./style/use-export-type.js";
import useImportType from "./style/use-import-type.js";
import useLiteralEnumMembers from "./style/use-literal-enum-members.js";
import useNodejsImportProtocol from "./style/use-nodejs-import-protocol.js";
import useShorthandFunctionType from "./style/use-shorthand-function-type.js";
import useTemplate from "./style/use-template.js";
import noApproximativeNumericConstant from "./suspicious/no-approximative-numeric-constant.js";
import noAssignInExpressions from "./suspicious/no-assign-in-expressions.js";
import noAsyncPromiseExecutor from "./suspicious/no-async-promise-executor.js";
import noCatchAssign from "./suspicious/no-catch-assign.js";
import noClassAssign from "./suspicious/no-class-assign.js";
import noCommentText from "./suspicious/no-comment-text.js";
import noCompareNegZero from "./suspicious/no-compare-neg-zero.js";
import noConfusingLabels from "./suspicious/no-confusing-labels.js";
import noConfusingVoidType from "./suspicious/no-confusing-void-type.js";
import noConstEnum from "./suspicious/no-const-enum.js";
import noControlCharactersInRegex from "./suspicious/no-control-characters-in-regex.js";
import noDebugger from "./suspicious/no-debugger.js";
import noDocumentCookie from "./suspicious/no-document-cookie.js";
import noDoubleEquals from "./suspicious/no-double-equals.js";
import noDuplicateCase from "./suspicious/no-duplicate-case.js";
import noDuplicateClassMembers from "./suspicious/no-duplicate-class-members.js";
import noDuplicateElseIf from "./suspicious/no-duplicate-else-if.js";
import noDuplicateEnumValues from "./suspicious/no-duplicate-enum-values.js";
import noDuplicateJsxProps from "./suspicious/no-duplicate-jsx-props.js";
import noDuplicateObjectKeys from "./suspicious/no-duplicate-object-keys.js";
import noDuplicateParameters from "./suspicious/no-duplicate-parameters.js";
import noEmptyInterface from "./suspicious/no-empty-interface.js";
import noExplicitAny from "./suspicious/no-explicit-any.js";
import noExtraNonNullAssertion from "./suspicious/no-extra-non-null-assertion.js";
import noFallthroughSwitchClause from "./suspicious/no-fallthrough-switch-clause.js";
import noFocusedTests from "./suspicious/no-focused-tests.js";
import noFunctionAssign from "./suspicious/no-function-assign.js";
import noGlobalAssign from "./suspicious/no-global-assign.js";
import noGlobalIsFinite from "./suspicious/no-global-is-finite.js";
import noGlobalIsNan from "./suspicious/no-global-is-nan.js";
import noImplicitAnyLet from "./suspicious/no-implicit-any-let.js";
import noImportAssign from "./suspicious/no-import-assign.js";
import noIrregularWhitespace from "./suspicious/no-irregular-whitespace.js";
import noLabelVar from "./suspicious/no-label-var.js";
import noMisleadingInstantiator from "./suspicious/no-misleading-instantiator.js";
import noMisrefactoredShorthandAssign from "./suspicious/no-misrefactored-shorthand-assign.js";
import noNonNullAssertedOptionalChain from "./suspicious/no-non-null-asserted-optional-chain.js";
import noOctalEscape from "./suspicious/no-octal-escape.js";
import noProto from "./suspicious/no-proto.js";
import noPrototypeBuiltins from "./suspicious/no-prototype-builtins.js";
import noRedeclare from "./suspicious/no-redeclare.js";
import noSelfCompare from "./suspicious/no-self-compare.js";
import noShadowRestrictedNames from "./suspicious/no-shadow-restricted-names.js";
import noSparseArray from "./suspicious/no-sparse-array.js";
import noSuspiciousSemicolonInJsx from "./suspicious/no-suspicious-semicolon-in-jsx.js";
import noTemplateCurlyInString from "./suspicious/no-template-curly-in-string.js";
import noThenProperty from "./suspicious/no-then-property.js";
import noTsIgnore from "./suspicious/no-ts-ignore.js";
import noUnsafeDeclarationMerging from "./suspicious/no-unsafe-declaration-merging.js";
import noUnsafeNegation from "./suspicious/no-unsafe-negation.js";
import noUselessEscapeInString from "./suspicious/no-useless-escape-in-string.js";
import noWith from "./suspicious/no-with.js";
import useAdjacentOverloadSignatures from "./suspicious/use-adjacent-overload-signatures.js";
import useDefaultSwitchClauseLast from "./suspicious/use-default-switch-clause-last.js";
import useGetterReturn from "./suspicious/use-getter-return.js";
import useIsArray from "./suspicious/use-is-array.js";
import useIterableCallbackReturn from "./suspicious/use-iterable-callback-return.js";
import useNamespaceKeyword from "./suspicious/use-namespace-keyword.js";

/** Every rule lintero implements, by group. */
export default [
    noAccessKey,
    noAriaHiddenOnFocusable,
    noAutofocus,
    noDistractingElements,
    noHeaderScope,
    noPositiveTabindex,
    noRedundantAlt,
    noSvgWithoutTitle,
    useAltText,
    useAnchorContent,
    useButtonType,
    useHeadingContent,
    useHtmlLang,
    useIframeTitle,
    useKeyWithClickEvents,
    useKeyWithMouseEvents,
    useMediaCaption,
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
    useNumericLiterals,
    useRegexLiterals,
    useSimpleNumberKeys,
    noConstAssign,
    noConstantCondition,
    noConstantMathMinMaxClamp,
    noConstructorReturn,
    noEmptyCharacterClassInRegex,
    noEmptyPattern,
    noGlobalObjectCalls,
    noInnerDeclarations,
    noInvalidBuiltinInstantiation,
    noInvalidConstructorSuper,
    noInvalidUseBeforeDeclaration,
    noNonoctalDecimalEscape,
    noPrecisionLoss,
    noSelfAssign,
    noSetterReturn,
    noStringCaseMismatch,
    noSwitchDeclarations,
    noUnreachable,
    noUnsafeFinally,
    noUnsafeOptionalChaining,
    noUnusedFunctionParameters,
    noUnusedImports,
    noUnusedLabels,
    noUnusedPrivateClassMembers,
    noUnusedVariables,
    noVoidElementsWithChildren,
    noVoidTypeReturn,
    useIsNan,
    useParseIntRadix,
    useValidForDirection,
    useValidTypeof,
    useYield,
    noAccumulatingSpread,
    noDynamicNamespaceImportAccess,
    noBlankTarget,
    noGlobalEval,
    noScriptUrl,
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
    noApproximativeNumericConstant,
    noAssignInExpressions,
    noAsyncPromiseExecutor,
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
    noDoubleEquals,
    noDuplicateCase,
    noDuplicateClassMembers,
    noDuplicateElseIf,
    noDuplicateEnumValues,
    noDuplicateJsxProps,
    noDuplicateObjectKeys,
    noDuplicateParameters,
    noEmptyInterface,
    noExplicitAny,
    noExtraNonNullAssertion,
    noFallthroughSwitchClause,
    noFocusedTests,
    noFunctionAssign,
    noGlobalAssign,
    noGlobalIsFinite,
    noGlobalIsNan,
    noImplicitAnyLet,
    noImportAssign,
    noIrregularWhitespace,
    noLabelVar,
    noMisleadingInstantiator,
    noMisrefactoredShorthandAssign,
    noNonNullAssertedOptionalChain,
    noOctalEscape,
    noProto,
    noPrototypeBuiltins,
    noRedeclare,
    noSelfCompare,
    noShadowRestrictedNames,
    noSparseArray,
    noSuspiciousSemicolonInJsx,
    noTemplateCurlyInString,
    noThenProperty,
    noTsIgnore,
    noUnsafeDeclarationMerging,
    noUnsafeNegation,
    noUselessEscapeInString,
    noWith,
    useAdjacentOverloadSignatures,
    useDefaultSwitchClauseLast,
    useGetterReturn,
    useIsArray,
    useIterableCallbackReturn,
    useNamespaceKeyword,
] as Rule[];
