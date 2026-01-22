import type { Comment } from "./scanner.js";

export interface Attached extends Comment {
    placement: "dangling" | "leading" | "trailing";
}

interface Base {
    start: number;
    end: number;
    comments?: Attached[];
    /** Set when the source wrapped the node in parentheses. */
    parenthesized?: boolean;
}

type Of<T extends string, F = object> = Base & { type: T } & F;

export type Accessibility = "private" | "protected" | "public";

interface Modifiers {
    accessibility?: Accessibility;
    abstract?: boolean;
    declare?: boolean;
    override?: boolean;
    readonly?: boolean;
    static?: boolean;
}

interface FunctionParts {
    id: Identifier | null;
    params: Node[];
    body: Node | null;
    async: boolean;
    generator: boolean;
    typeParameters: TypeParameters | null;
    returnType: Node | null;
}

// Program and statements

export type Program = Of<"Program", { body: Node[]; directives: Node[] }>;
export type Directive = Of<"Directive", { value: StringLiteral }>;
export type ExpressionStatement = Of<
    "ExpressionStatement",
    { expression: Node }
>;
export type BlockStatement = Of<
    "BlockStatement",
    { body: Node[]; directives: Node[] }
>;
export type EmptyStatement = Of<"EmptyStatement">;
export type DebuggerStatement = Of<"DebuggerStatement">;
export type ReturnStatement = Of<"ReturnStatement", { argument: Node | null }>;
export type ThrowStatement = Of<"ThrowStatement", { argument: Node }>;
export type BreakStatement = Of<"BreakStatement", { label: Identifier | null }>;
export type ContinueStatement = Of<
    "ContinueStatement",
    { label: Identifier | null }
>;
export type LabeledStatement = Of<
    "LabeledStatement",
    { label: Identifier; body: Node }
>;
export type IfStatement = Of<
    "IfStatement",
    { test: Node; consequent: Node; alternate: Node | null }
>;
export type SwitchStatement = Of<
    "SwitchStatement",
    { discriminant: Node; cases: SwitchCase[] }
>;
export type SwitchCase = Of<
    "SwitchCase",
    { test: Node | null; consequent: Node[] }
>;
export type WhileStatement = Of<"WhileStatement", { test: Node; body: Node }>;
export type DoWhileStatement = Of<
    "DoWhileStatement",
    { test: Node; body: Node }
>;
export type ForStatement = Of<
    "ForStatement",
    { init: Node | null; test: Node | null; update: Node | null; body: Node }
>;
export type ForInStatement = Of<
    "ForInStatement",
    { left: Node; right: Node; body: Node }
>;
export type ForOfStatement = Of<
    "ForOfStatement",
    { left: Node; right: Node; body: Node; await: boolean }
>;
export type TryStatement = Of<
    "TryStatement",
    {
        block: BlockStatement;
        handler: CatchClause | null;
        finalizer: BlockStatement | null;
    }
>;
export type CatchClause = Of<
    "CatchClause",
    { param: Node | null; body: BlockStatement }
>;
export type WithStatement = Of<"WithStatement", { object: Node; body: Node }>;
export type VariableDeclaration = Of<
    "VariableDeclaration",
    { kind: string; declarations: VariableDeclarator[]; declare: boolean }
>;
export type VariableDeclarator = Of<
    "VariableDeclarator",
    { id: Node; init: Node | null; definite: boolean }
>;
export type FunctionDeclaration = Of<
    "FunctionDeclaration",
    FunctionParts & { declare: boolean }
>;
export type ClassDeclaration = Of<"ClassDeclaration", ClassParts>;

// Modules

export type ImportDeclaration = Of<
    "ImportDeclaration",
    {
        specifiers: Node[];
        source: StringLiteral;
        attributes: Node[];
        importKind: "type" | "typeof" | "value";
        phase: string | null;
    }
>;
export type ImportSpecifier = Of<
    "ImportSpecifier",
    { imported: Node; local: Identifier; importKind: "type" | "value" }
>;
export type ImportDefaultSpecifier = Of<
    "ImportDefaultSpecifier",
    { local: Identifier }
>;
export type ImportNamespaceSpecifier = Of<
    "ImportNamespaceSpecifier",
    { local: Identifier }
>;
export type ImportAttribute = Of<
    "ImportAttribute",
    { key: Node; value: StringLiteral }
>;
export type ExportNamedDeclaration = Of<
    "ExportNamedDeclaration",
    {
        declaration: Node | null;
        specifiers: Node[];
        source: StringLiteral | null;
        attributes: Node[];
        exportKind: "type" | "value";
    }
>;
export type ExportSpecifier = Of<
    "ExportSpecifier",
    { local: Node; exported: Node; exportKind: "type" | "value" }
>;
export type ExportDefaultDeclaration = Of<
    "ExportDefaultDeclaration",
    { declaration: Node }
>;
export type ExportAllDeclaration = Of<
    "ExportAllDeclaration",
    {
        exported: Node | null;
        source: StringLiteral;
        attributes: Node[];
        exportKind: "type" | "value";
    }
>;

// Expressions

export type Identifier = Of<
    "Identifier",
    { name: string; optional?: boolean; typeAnnotation?: Node | null }
>;
export type PrivateName = Of<"PrivateName", { name: string }>;
export type StringLiteral = Of<"StringLiteral", { raw: string }>;
export type NumericLiteral = Of<"NumericLiteral", { raw: string }>;
export type BooleanLiteral = Of<"BooleanLiteral", { value: boolean }>;
export type NullLiteral = Of<"NullLiteral">;
export type RegExpLiteral = Of<"RegExpLiteral", { raw: string }>;
export type TemplateLiteral = Of<
    "TemplateLiteral",
    { quasis: TemplateElement[]; expressions: Node[] }
>;
export type TemplateElement = Of<
    "TemplateElement",
    { raw: string; tail: boolean }
>;
export type TaggedTemplateExpression = Of<
    "TaggedTemplateExpression",
    { tag: Node; quasi: TemplateLiteral; typeArguments: TypeArguments | null }
>;
export type ThisExpression = Of<"ThisExpression">;
export type Super = Of<"Super">;
export type ArrayExpression = Of<
    "ArrayExpression",
    { elements: (Node | null)[] }
>;
export type ObjectExpression = Of<"ObjectExpression", { properties: Node[] }>;
export type Property = Of<
    "Property",
    {
        key: Node;
        value: Node;
        kind: "get" | "init" | "set";
        method: boolean;
        shorthand: boolean;
        computed: boolean;
    }
>;
export type SpreadElement = Of<"SpreadElement", { argument: Node }>;
export type FunctionExpression = Of<"FunctionExpression", FunctionParts>;
export type ArrowFunctionExpression = Of<
    "ArrowFunctionExpression",
    FunctionParts & { body: Node }
>;
export type ClassExpression = Of<"ClassExpression", ClassParts>;
export type CallExpression = Of<
    "CallExpression",
    {
        callee: Node;
        arguments: Node[];
        optional: boolean;
        typeArguments: TypeArguments | null;
    }
>;
export type NewExpression = Of<
    "NewExpression",
    {
        callee: Node;
        arguments: Node[];
        typeArguments: TypeArguments | null;
        parentheses: boolean;
    }
>;
export type ImportExpression = Of<
    "ImportExpression",
    { source: Node; options: Node | null; phase: string | null }
>;
export type MemberExpression = Of<
    "MemberExpression",
    { object: Node; property: Node; computed: boolean; optional: boolean }
>;
export type MetaProperty = Of<
    "MetaProperty",
    { meta: string; property: string }
>;
export type UnaryExpression = Of<
    "UnaryExpression",
    { operator: string; argument: Node }
>;
export type UpdateExpression = Of<
    "UpdateExpression",
    { operator: string; prefix: boolean; argument: Node }
>;
export type BinaryExpression = Of<
    "BinaryExpression",
    { operator: string; left: Node; right: Node }
>;
export type LogicalExpression = Of<
    "LogicalExpression",
    { operator: string; left: Node; right: Node }
>;
export type AssignmentExpression = Of<
    "AssignmentExpression",
    { operator: string; left: Node; right: Node }
>;
export type ConditionalExpression = Of<
    "ConditionalExpression",
    { test: Node; consequent: Node; alternate: Node }
>;
export type SequenceExpression = Of<
    "SequenceExpression",
    { expressions: Node[] }
>;
export type YieldExpression = Of<
    "YieldExpression",
    { argument: Node | null; delegate: boolean }
>;
export type AwaitExpression = Of<"AwaitExpression", { argument: Node }>;

// Patterns

export type ObjectPattern = Of<
    "ObjectPattern",
    { properties: Node[]; typeAnnotation: Node | null; optional?: boolean }
>;
export type ArrayPattern = Of<
    "ArrayPattern",
    {
        elements: (Node | null)[];
        typeAnnotation: Node | null;
        optional?: boolean;
    }
>;
export type AssignmentPattern = Of<
    "AssignmentPattern",
    { left: Node; right: Node }
>;
export type RestElement = Of<
    "RestElement",
    { argument: Node; typeAnnotation: Node | null; optional?: boolean }
>;
export type ParameterProperty = Of<
    "TSParameterProperty",
    Modifiers & { decorators: Decorator[]; parameter: Node }
>;

// Classes

interface ClassParts {
    id: Identifier | null;
    superClass: Node | null;
    superTypeArguments: TypeArguments | null;
    implements: Node[];
    body: ClassBody;
    decorators: Decorator[];
    typeParameters: TypeParameters | null;
    abstract: boolean;
    declare: boolean;
}

export type ClassBody = Of<"ClassBody", { body: Node[] }>;
export type MethodDefinition = Of<
    "MethodDefinition",
    Modifiers & {
        key: Node;
        value: FunctionExpression;
        kind: "constructor" | "get" | "method" | "set";
        computed: boolean;
        optional: boolean;
        decorators: Decorator[];
    }
>;
export type PropertyDefinition = Of<
    "PropertyDefinition",
    Modifiers & {
        key: Node;
        value: Node | null;
        computed: boolean;
        optional: boolean;
        definite: boolean;
        accessor: boolean;
        typeAnnotation: Node | null;
        decorators: Decorator[];
    }
>;
export type StaticBlock = Of<"StaticBlock", { body: Node[] }>;
export type Decorator = Of<"Decorator", { expression: Node }>;

// JSX

export type JSXElement = Of<
    "JSXElement",
    {
        name: string | null;
        attributes: Node[];
        children: Node[];
        selfClosing: boolean;
        typeArguments: TypeArguments | null;
    }
>;
export type JSXAttribute = Of<
    "JSXAttribute",
    { name: string; value: Node | null }
>;
export type JSXSpreadAttribute = Of<"JSXSpreadAttribute", { argument: Node }>;
export type JSXExpressionContainer = Of<
    "JSXExpressionContainer",
    { expression: Node | null }
>;
export type JSXSpreadChild = Of<"JSXSpreadChild", { expression: Node }>;
export type JSXText = Of<"JSXText", { raw: string }>;

// TypeScript expressions and declarations

export type TSAsExpression = Of<
    "TSAsExpression",
    { expression: Node; typeAnnotation: Node }
>;
export type TSSatisfiesExpression = Of<
    "TSSatisfiesExpression",
    { expression: Node; typeAnnotation: Node }
>;
export type TSNonNullExpression = Of<
    "TSNonNullExpression",
    { expression: Node }
>;
export type TSTypeAssertion = Of<
    "TSTypeAssertion",
    { expression: Node; typeAnnotation: Node }
>;
export type TSInstantiationExpression = Of<
    "TSInstantiationExpression",
    { expression: Node; typeArguments: TypeArguments }
>;
export type TSInterfaceDeclaration = Of<
    "TSInterfaceDeclaration",
    {
        id: Identifier;
        typeParameters: TypeParameters | null;
        extends: Node[];
        body: TSInterfaceBody;
        declare: boolean;
    }
>;
export type TSInterfaceBody = Of<"TSInterfaceBody", { body: Node[] }>;
export type TSTypeAliasDeclaration = Of<
    "TSTypeAliasDeclaration",
    {
        id: Identifier;
        typeParameters: TypeParameters | null;
        typeAnnotation: Node;
        declare: boolean;
    }
>;
export type TSEnumDeclaration = Of<
    "TSEnumDeclaration",
    {
        id: Identifier;
        members: TSEnumMember[];
        const: boolean;
        declare: boolean;
    }
>;
export type TSEnumMember = Of<
    "TSEnumMember",
    { id: Node; initializer: Node | null }
>;
export type TSModuleDeclaration = Of<
    "TSModuleDeclaration",
    {
        id: Node;
        body: TSModuleBlock | null;
        kind: "global" | "module" | "namespace";
        declare: boolean;
    }
>;
export type TSModuleBlock = Of<"TSModuleBlock", { body: Node[] }>;
export type TSDeclareFunction = Of<
    "TSDeclareFunction",
    FunctionParts & { declare: boolean }
>;
export type TSExportAssignment = Of<"TSExportAssignment", { expression: Node }>;
export type TSNamespaceExportDeclaration = Of<
    "TSNamespaceExportDeclaration",
    { id: Identifier }
>;
export type TSImportEqualsDeclaration = Of<
    "TSImportEqualsDeclaration",
    {
        id: Identifier;
        moduleReference: Node;
        importKind: "type" | "value";
        isExport: boolean;
    }
>;
export type TSExternalModuleReference = Of<
    "TSExternalModuleReference",
    { expression: StringLiteral }
>;

// TypeScript types

export type TypeParameters = Of<
    "TSTypeParameterDeclaration",
    { params: TSTypeParameter[] }
>;
export type TSTypeParameter = Of<
    "TSTypeParameter",
    {
        name: string;
        constraint: Node | null;
        default: Node | null;
        in: boolean;
        out: boolean;
        const: boolean;
    }
>;
export type TypeArguments = Of<
    "TSTypeParameterInstantiation",
    { params: Node[] }
>;
export type TSKeyword = Of<"TSKeyword", { name: string }>;
export type TSTypeReference = Of<
    "TSTypeReference",
    { typeName: Node; typeArguments: TypeArguments | null }
>;
export type TSQualifiedName = Of<
    "TSQualifiedName",
    { left: Node; right: Identifier }
>;
export type TSLiteralType = Of<"TSLiteralType", { literal: Node }>;
export type TSTemplateLiteralType = Of<
    "TSTemplateLiteralType",
    { quasis: TemplateElement[]; types: Node[] }
>;
export type TSUnionType = Of<"TSUnionType", { types: Node[] }>;
export type TSIntersectionType = Of<"TSIntersectionType", { types: Node[] }>;
export type TSFunctionType = Of<
    "TSFunctionType",
    { typeParameters: TypeParameters | null; params: Node[]; returnType: Node }
>;
export type TSConstructorType = Of<
    "TSConstructorType",
    {
        typeParameters: TypeParameters | null;
        params: Node[];
        returnType: Node;
        abstract: boolean;
    }
>;
export type TSArrayType = Of<"TSArrayType", { elementType: Node }>;
export type TSTupleType = Of<"TSTupleType", { elementTypes: Node[] }>;
export type TSNamedTupleMember = Of<
    "TSNamedTupleMember",
    { label: Identifier; elementType: Node; optional: boolean }
>;
export type TSOptionalType = Of<"TSOptionalType", { typeAnnotation: Node }>;
export type TSRestType = Of<"TSRestType", { typeAnnotation: Node }>;
export type TSTypeLiteral = Of<"TSTypeLiteral", { members: Node[] }>;
export type TSTypeOperator = Of<
    "TSTypeOperator",
    { operator: string; typeAnnotation: Node }
>;
export type TSIndexedAccessType = Of<
    "TSIndexedAccessType",
    { objectType: Node; indexType: Node }
>;
export type TSConditionalType = Of<
    "TSConditionalType",
    { checkType: Node; extendsType: Node; trueType: Node; falseType: Node }
>;
export type TSInferType = Of<
    "TSInferType",
    { name: string; constraint: Node | null }
>;
export type TSTypeQuery = Of<
    "TSTypeQuery",
    { exprName: Node; typeArguments: TypeArguments | null }
>;
export type TSImportType = Of<
    "TSImportType",
    {
        argument: Node;
        options: Node | null;
        qualifier: Node | null;
        typeArguments: TypeArguments | null;
    }
>;
export type TSMappedType = Of<
    "TSMappedType",
    {
        key: string;
        constraint: Node;
        nameType: Node | null;
        typeAnnotation: Node | null;
        optional: string | null;
        readonly: string | null;
    }
>;
export type TSTypePredicate = Of<
    "TSTypePredicate",
    { parameterName: Node; typeAnnotation: Node | null; asserts: boolean }
>;
export type TSThisType = Of<"TSThisType">;
export type TSParenthesizedType = Of<
    "TSParenthesizedType",
    { typeAnnotation: Node }
>;
export type TSPropertySignature = Of<
    "TSPropertySignature",
    {
        key: Node;
        computed: boolean;
        optional: boolean;
        readonly: boolean;
        typeAnnotation: Node | null;
    }
>;
export type TSMethodSignature = Of<
    "TSMethodSignature",
    {
        key: Node;
        computed: boolean;
        optional: boolean;
        kind: "get" | "method" | "set";
        typeParameters: TypeParameters | null;
        params: Node[];
        returnType: Node | null;
    }
>;
export type TSIndexSignature = Of<
    "TSIndexSignature",
    {
        parameters: Node[];
        typeAnnotation: Node | null;
        readonly: boolean;
        static: boolean;
    }
>;
export type TSCallSignatureDeclaration = Of<
    "TSCallSignatureDeclaration",
    {
        typeParameters: TypeParameters | null;
        params: Node[];
        returnType: Node | null;
    }
>;
export type TSConstructSignatureDeclaration = Of<
    "TSConstructSignatureDeclaration",
    {
        typeParameters: TypeParameters | null;
        params: Node[];
        returnType: Node | null;
    }
>;

export type Node =
    | ArrayExpression
    | ArrayPattern
    | ArrowFunctionExpression
    | AssignmentExpression
    | AssignmentPattern
    | AwaitExpression
    | BinaryExpression
    | BlockStatement
    | BooleanLiteral
    | BreakStatement
    | CallExpression
    | CatchClause
    | ClassBody
    | ClassDeclaration
    | ClassExpression
    | ConditionalExpression
    | ContinueStatement
    | DebuggerStatement
    | Decorator
    | Directive
    | DoWhileStatement
    | EmptyStatement
    | ExportAllDeclaration
    | ExportDefaultDeclaration
    | ExportNamedDeclaration
    | ExportSpecifier
    | ExpressionStatement
    | ForInStatement
    | ForOfStatement
    | ForStatement
    | FunctionDeclaration
    | FunctionExpression
    | Identifier
    | IfStatement
    | ImportAttribute
    | ImportDeclaration
    | ImportDefaultSpecifier
    | ImportExpression
    | ImportNamespaceSpecifier
    | ImportSpecifier
    | JSXAttribute
    | JSXElement
    | JSXExpressionContainer
    | JSXSpreadAttribute
    | JSXSpreadChild
    | JSXText
    | LabeledStatement
    | LogicalExpression
    | MemberExpression
    | MetaProperty
    | MethodDefinition
    | NewExpression
    | NullLiteral
    | NumericLiteral
    | ObjectExpression
    | ObjectPattern
    | ParameterProperty
    | PrivateName
    | Program
    | Property
    | PropertyDefinition
    | RegExpLiteral
    | RestElement
    | ReturnStatement
    | SequenceExpression
    | SpreadElement
    | StaticBlock
    | StringLiteral
    | Super
    | SwitchCase
    | SwitchStatement
    | TaggedTemplateExpression
    | TemplateElement
    | TemplateLiteral
    | ThisExpression
    | ThrowStatement
    | TryStatement
    | TSArrayType
    | TSAsExpression
    | TSCallSignatureDeclaration
    | TSConditionalType
    | TSConstructorType
    | TSConstructSignatureDeclaration
    | TSDeclareFunction
    | TSEnumDeclaration
    | TSEnumMember
    | TSExportAssignment
    | TSExternalModuleReference
    | TSFunctionType
    | TSImportEqualsDeclaration
    | TSImportType
    | TSIndexedAccessType
    | TSIndexSignature
    | TSInferType
    | TSInstantiationExpression
    | TSInterfaceBody
    | TSInterfaceDeclaration
    | TSIntersectionType
    | TSKeyword
    | TSLiteralType
    | TSMappedType
    | TSMethodSignature
    | TSModuleBlock
    | TSModuleDeclaration
    | TSNamedTupleMember
    | TSNamespaceExportDeclaration
    | TSNonNullExpression
    | TSOptionalType
    | TSParenthesizedType
    | TSPropertySignature
    | TSQualifiedName
    | TSRestType
    | TSSatisfiesExpression
    | TSTemplateLiteralType
    | TSThisType
    | TSTupleType
    | TSTypeAliasDeclaration
    | TSTypeAssertion
    | TSTypeLiteral
    | TSTypeOperator
    | TSTypePredicate
    | TSTypeQuery
    | TSTypeReference
    | TSUnionType
    | TypeArguments
    | TypeParameters
    | TSTypeParameter
    | UnaryExpression
    | UpdateExpression
    | VariableDeclaration
    | VariableDeclarator
    | WhileStatement
    | WithStatement
    | YieldExpression;

export type NodeType = Node["type"];
export type NodeOf<T extends NodeType> = Extract<Node, { type: T }>;
