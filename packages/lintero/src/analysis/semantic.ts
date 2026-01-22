import { type Node, type NodeOf, Walker } from "@aljazmc/syntax";

export type BindingKind =
    | "catch"
    | "class"
    | "const"
    | "enum"
    | "enumMember"
    | "function"
    | "import"
    | "infer"
    | "interface"
    | "let"
    | "namespace"
    | "parameter"
    | "typeAlias"
    | "typeParameter"
    | "using"
    | "var";

export type ScopeKind =
    | "block"
    | "class"
    | "function"
    | "module"
    | "program"
    | "type";

export interface Scope {
    kind: ScopeKind;
    node: Node;
    parent: Scope | undefined;
    bindings: Map<string, Binding>;
}

export interface Declaration {
    kind: BindingKind;
    /** The declared name, an identifier, or the node holding the name. */
    id: Node;
    start: number;
    end: number;
    /** The declaring node, like a variable declarator or a function. */
    node: Node;
    /** The variable initializer, if any. */
    init: Node | null;
    /** Declared by a pattern with a rest element beside it. */
    restSibling: boolean;
    /** Declared with `declare`, in a declaration file or an ambient context. */
    ambient: boolean;
    /** The name of a function or class expression, local to itself. */
    local: boolean;
}

export interface Binding {
    name: string;
    scope: Scope;
    declarations: Declaration[];
    references: Reference[];
    exported: boolean;
}

export interface Reference {
    name: string;
    node: Node;
    start: number;
    end: number;
    scope: Scope;
    binding: Binding | undefined;
    /** Whether the value is read, also by `a++` or `a += 1` when their result is used. */
    read: boolean;
    write: boolean;
    /** Whether the reference names a type, `typeof` queries are values. */
    type: boolean;
    /** The assignment or update expression writing the reference. */
    writer?: Node;
}

type Mode = "type" | "value";

/** Scopes, bindings and references of a program. */
export default class Semantic {
    readonly scopes: Scope[] = [];
    readonly bindings: Binding[] = [];
    readonly references: Reference[] = [];

    readonly #source: string;
    readonly #ambient: boolean;
    readonly #scopeOf = new Map<Node, Scope>();
    readonly #declared = new Map<Node, Binding>();
    readonly #referenced = new Map<Node, Reference>();
    /** Updates and compound assignments whose value is not used. */
    readonly #discarded = new Set<Node>();
    readonly #exports: Reference[] = [];
    #inAmbient = false;

    /**
     * With `declarations`, the program is a declaration file. Without imports
     * or exports, its top level declarations then describe globals.
     */
    constructor(program: Node, source: string, declarations = false) {
        this.#source = source;
        this.#ambient =
            declarations &&
            program.type === "Program" &&
            !program.body.some((statement) =>
                /^(Import|Export|TSExport|TSImportEquals)/.test(statement.type),
            );
        this.#visit(program, this.#scope("program", program, undefined));
        for (const reference of this.references) this.#resolve(reference);
        for (const reference of this.#exports)
            if (reference.binding) reference.binding.exported = true;
    }

    /** The scope a node creates, like a function's or a block's. */
    scopeOf(node: Node): Scope | undefined {
        return this.#scopeOf.get(node);
    }

    /** The binding an identifier declares. */
    declared(node: Node): Binding | undefined {
        return this.#declared.get(node);
    }

    /** The reference an identifier makes. */
    referenced(node: Node): Reference | undefined {
        return this.#referenced.get(node);
    }

    /** Whether an identifier refers to a global, not to a declared binding. */
    isGlobal(node: Node): boolean {
        const reference = this.#referenced.get(node);
        return reference !== undefined && reference.binding === undefined;
    }

    /** The innermost scope around a position. */
    scopeAt(position: number): Scope {
        let found = this.scopes[0] as Scope;
        for (const scope of this.scopes)
            if (scope.node.start <= position && position < scope.node.end)
                found = scope;
        return found;
    }

    /** The binding a name resolves to from a scope. */
    lookup(name: string, scope: Scope): Binding | undefined {
        for (
            let current: Scope | undefined = scope;
            current;
            current = current.parent
        ) {
            const binding = current.bindings.get(name);
            if (binding) return binding;
        }
    }

    #scope(kind: ScopeKind, node: Node, parent: Scope | undefined): Scope {
        const scope: Scope = { kind, node, parent, bindings: new Map() };
        this.scopes.push(scope);
        this.#scopeOf.set(node, scope);
        return scope;
    }

    #resolve(reference: Reference): void {
        for (
            let scope: Scope | undefined = reference.scope;
            scope;
            scope = scope.parent
        ) {
            const binding = scope.bindings.get(reference.name);
            if (binding && this.#exports.includes(reference)) {
                reference.binding = binding;
                binding.references.push(reference);
                return;
            }
            if (
                binding?.declarations.some((declaration) =>
                    Semantic.#namespaces(declaration.kind).includes(
                        reference.type ? "type" : "value",
                    ),
                )
            ) {
                reference.binding = binding;
                binding.references.push(reference);
                return;
            }
        }
    }

    static #namespaces(kind: BindingKind): Mode[] {
        switch (kind) {
            case "interface":
            case "typeAlias":
            case "typeParameter":
            case "infer":
                return ["type"];
            case "class":
            case "enum":
            case "import":
            case "namespace":
                return ["type", "value"];
            default:
                return ["value"];
        }
    }

    /** The scope var declarations and functions belong to. */
    static #hoisting(scope: Scope): Scope {
        let current = scope;
        while (
            !["function", "module", "program"].includes(current.kind) &&
            current.parent
        )
            current = current.parent;
        return current;
    }

    #declare(
        scope: Scope,
        id: Node,
        name: string,
        kind: BindingKind,
        node: Node,
        details: Partial<Declaration> = {},
    ): Binding {
        let binding = scope.bindings.get(name);
        if (!binding) {
            binding = {
                name,
                scope,
                declarations: [],
                references: [],
                exported: false,
            };
            scope.bindings.set(name, binding);
            this.bindings.push(binding);
        }

        const start = this.#nameStart(id, name);
        binding.declarations.push({
            kind,
            id,
            start,
            end: start + name.length,
            node,
            init: null,
            restSibling: false,
            // top level declarations of declaration files describe globals or exports
            ambient:
                (this.#ambient && scope.kind === "program") || this.#inAmbient,
            local: false,
            ...details,
        });
        this.#declared.set(id, binding);
        return binding;
    }

    /** Where a name starts, identifiers start at it, other nodes contain it. */
    #nameStart(id: Node, name: string): number {
        if (id.type === "Identifier") return id.start;
        const pattern = new RegExp(
            `(?<![\\p{ID_Continue}$])${name.replace(/\$/g, "\\$")}(?![\\p{ID_Continue}$])`,
            "u",
        );
        let from = id.start;
        if (id.type === "TSInferType") from += "infer".length;
        const index = this.#source.slice(from, id.end).search(pattern);
        return index < 0 ? id.start : from + index;
    }

    #reference(
        node: Node,
        name: string,
        scope: Scope,
        mode: Mode,
        flags: Partial<Reference> = {},
    ): Reference {
        const start =
            node.type === "Identifier"
                ? node.start
                : this.#nameStart(node, name);
        const reference: Reference = {
            name,
            node,
            start,
            end: start + name.length,
            scope,
            binding: undefined,
            read: mode === "value",
            write: false,
            type: mode === "type",
            ...flags,
        };
        this.references.push(reference);
        this.#referenced.set(node, reference);
        return reference;
    }

    #visitAll(
        nodes: readonly (Node | null)[],
        scope: Scope,
        mode: Mode = "value",
    ): void {
        for (const node of nodes) if (node) this.#visit(node, scope, mode);
    }

    #visitChildren(node: Node, scope: Scope, mode: Mode): void {
        for (const child of Walker.children(node))
            this.#visit(child, scope, mode);
    }

    #visit(node: Node, scope: Scope, mode: Mode = "value"): void {
        switch (node.type) {
            case "Program":
                this.#visitAll(node.body, scope);
                return;
            case "Identifier":
                this.#reference(node, node.name, scope, mode);
                if (node.typeAnnotation)
                    this.#visit(node.typeAnnotation, scope, "type");
                return;
            case "ExpressionStatement":
                this.#discard(node.expression);
                this.#visit(node.expression, scope);
                return;
            case "BlockStatement":
                this.#visitAll(node.body, this.#scope("block", node, scope));
                return;
            case "StaticBlock":
                this.#visitAll(node.body, this.#scope("function", node, scope));
                return;
            case "VariableDeclaration":
                this.#variables(node, scope);
                return;
            case "FunctionDeclaration":
            case "TSDeclareFunction":
                this.#ambiently(
                    node.type === "TSDeclareFunction" || node.declare,
                    () => {
                        if (node.id) {
                            const binding = this.#declare(
                                scope,
                                node.id,
                                node.id.name,
                                "function",
                                node,
                            );
                            this.#inAmbient ||= Semantic.#ambientLast(binding);
                        }
                        this.#function(node, scope);
                    },
                );
                return;
            case "FunctionExpression":
            case "ArrowFunctionExpression":
                this.#function(node, scope);
                return;
            case "ClassDeclaration":
            case "ClassExpression":
                this.#class(node, scope);
                return;
            case "ImportDeclaration":
                this.#import(node, scope);
                return;
            case "TSImportEqualsDeclaration":
                this.#declare(scope, node.id, node.id.name, "import", node);
                if (node.moduleReference.type !== "TSExternalModuleReference")
                    this.#qualified(node.moduleReference, scope, "value");
                return;
            case "ExportNamedDeclaration":
                this.#exportNamed(node, scope);
                return;
            case "ExportDefaultDeclaration":
            case "TSExportAssignment": {
                const declaration =
                    node.type === "ExportDefaultDeclaration"
                        ? node.declaration
                        : node.expression;
                this.#visit(declaration, scope);
                this.#exportDeclared(declaration, scope);
                if (declaration.type === "Identifier")
                    this.#exportReferenced(declaration);
                return;
            }
            case "ExportAllDeclaration":
                return;
            case "LabeledStatement":
                this.#visit(node.body, scope);
                return;
            case "BreakStatement":
            case "ContinueStatement":
                return;
            case "CatchClause": {
                const inner = this.#scope("block", node, scope);
                if (node.param) this.#pattern(node.param, inner, "catch", node);
                this.#visit(node.body, inner);
                return;
            }
            case "ForStatement":
            case "ForInStatement":
            case "ForOfStatement":
                this.#loop(node, scope);
                return;
            case "SwitchStatement": {
                this.#visit(node.discriminant, scope);
                this.#visitAll(node.cases, this.#scope("block", node, scope));
                return;
            }
            case "AssignmentExpression":
                this.#target(node.left, scope, node, node.operator !== "=");
                this.#visit(node.right, scope);
                return;
            case "UpdateExpression":
                this.#target(node.argument, scope, node, true);
                return;
            case "MemberExpression":
                this.#visit(node.object, scope, mode);
                if (node.computed) this.#visit(node.property, scope, mode);
                return;
            case "Property":
            case "MethodDefinition":
            case "PropertyDefinition":
            case "TSPropertySignature":
                this.#member(node, scope);
                return;
            case "JSXElement":
                this.#jsx(node, scope);
                return;
            case "MetaProperty":
            case "PrivateName":
            case "JSXAttribute":
                if (node.type === "JSXAttribute" && node.value)
                    this.#visit(node.value, scope);
                return;
            case "TSInterfaceDeclaration":
                this.#ambiently(node.declare, () => {
                    const binding = this.#declare(
                        scope,
                        node.id,
                        node.id.name,
                        "interface",
                        node,
                    );
                    this.#inAmbient ||= Semantic.#ambientLast(binding);
                    const inner = this.#scope("type", node, scope);
                    this.#typeParameters(node.typeParameters, inner);
                    this.#visitAll(node.extends, inner, "type");
                    this.#visitAll(node.body.body, inner, "type");
                });
                return;
            case "TSTypeAliasDeclaration":
                this.#ambiently(node.declare, () => {
                    const binding = this.#declare(
                        scope,
                        node.id,
                        node.id.name,
                        "typeAlias",
                        node,
                    );
                    this.#inAmbient ||= Semantic.#ambientLast(binding);
                    const inner = this.#scope("type", node, scope);
                    this.#typeParameters(node.typeParameters, inner);
                    this.#visit(node.typeAnnotation, inner, "type");
                });
                return;
            case "TSEnumDeclaration":
                this.#ambiently(node.declare, () => {
                    this.#declare(scope, node.id, node.id.name, "enum", node);
                    const inner = this.#scope("block", node, scope);
                    for (const member of node.members)
                        if (member.id.type === "Identifier")
                            this.#declare(
                                inner,
                                member.id,
                                member.id.name,
                                "enumMember",
                                member,
                            );
                    for (const member of node.members)
                        if (member.initializer)
                            this.#visit(member.initializer, inner);
                });
                return;
            case "TSModuleDeclaration":
                this.#namespace(node, scope);
                return;
            case "TSTypeReference":
                this.#qualified(node.typeName, scope, "type");
                if (node.typeArguments)
                    this.#visit(node.typeArguments, scope, "type");
                return;
            case "TSTypeQuery":
                if (node.exprName.type === "TSImportType")
                    this.#visit(node.exprName, scope, "type");
                else
                    this.#qualified(node.exprName, scope, "value", {
                        read: false,
                    });
                if (node.typeArguments)
                    this.#visit(node.typeArguments, scope, "type");
                return;
            case "TSImportType":
                if (node.typeArguments)
                    this.#visit(node.typeArguments, scope, "type");
                return;
            case "TSFunctionType":
            case "TSConstructorType":
            case "TSCallSignatureDeclaration":
            case "TSConstructSignatureDeclaration":
            case "TSMethodSignature": {
                if (node.type === "TSMethodSignature" && node.computed)
                    this.#visit(node.key, scope);
                const inner = this.#scope("type", node, scope);
                this.#typeParameters(node.typeParameters, inner);
                for (const param of node.params)
                    this.#signatureParameter(param, inner);
                if (node.returnType)
                    this.#visit(node.returnType, inner, "type");
                return;
            }
            case "TSIndexSignature":
                for (const param of node.parameters)
                    this.#signatureParameter(param, scope);
                if (node.typeAnnotation)
                    this.#visit(node.typeAnnotation, scope, "type");
                return;
            case "TSMappedType": {
                const inner = this.#scope("type", node, scope);
                this.#visit(node.constraint, scope, "type");
                this.#declare(inner, node, node.key, "typeParameter", node);
                if (node.nameType) this.#visit(node.nameType, inner, "type");
                if (node.typeAnnotation)
                    this.#visit(node.typeAnnotation, inner, "type");
                return;
            }
            case "TSConditionalType": {
                this.#visit(node.checkType, scope, "type");
                const inner = this.#scope("type", node, scope);
                this.#visit(node.extendsType, inner, "type");
                this.#visit(node.trueType, inner, "type");
                this.#visit(node.falseType, scope, "type");
                return;
            }
            case "TSInferType":
                this.#declare(scope, node, node.name, "infer", node);
                if (node.constraint)
                    this.#visit(node.constraint, scope, "type");
                return;
            case "TSTypePredicate":
                if (node.typeAnnotation)
                    this.#visit(node.typeAnnotation, scope, "type");
                return;
            case "TSNamedTupleMember":
                this.#visit(node.elementType, scope, "type");
                return;
            case "TSQualifiedName":
                this.#qualified(node, scope, mode);
                return;
            case "TSAsExpression":
            case "TSSatisfiesExpression":
            case "TSTypeAssertion":
                this.#visit(node.expression, scope);
                this.#visit(node.typeAnnotation, scope, "type");
                return;
            case "TSInstantiationExpression":
                this.#visit(node.expression, scope);
                this.#visit(node.typeArguments, scope, "type");
                return;
            case "CallExpression":
            case "NewExpression":
            case "TaggedTemplateExpression":
                this.#visit(
                    node.type === "TaggedTemplateExpression"
                        ? node.tag
                        : node.callee,
                    scope,
                );
                if (node.typeArguments)
                    this.#visit(node.typeArguments, scope, "type");
                this.#visitAll(
                    node.type === "TaggedTemplateExpression"
                        ? [node.quasi]
                        : node.arguments,
                    scope,
                );
                return;
            default:
                this.#visitChildren(node, scope, mode);
        }
    }

    /** Whether the last declaration of a binding is ambient, its parts are then too. */
    static #ambientLast(binding: Binding): boolean {
        return binding.declarations.at(-1)?.ambient ?? false;
    }

    #ambiently(ambient: boolean, visit: () => void): void {
        const previous = this.#inAmbient;
        this.#inAmbient = previous || ambient;
        visit();
        this.#inAmbient = previous;
    }

    #variables(node: NodeOf<"VariableDeclaration">, scope: Scope): void {
        const kind =
            node.kind === "var"
                ? "var"
                : node.kind.includes("using")
                  ? "using"
                  : (node.kind as "const" | "let");
        const target = kind === "var" ? Semantic.#hoisting(scope) : scope;

        this.#ambiently(node.declare, () => {
            for (const declarator of node.declarations) {
                this.#pattern(
                    declarator.id,
                    target,
                    kind,
                    declarator,
                    {
                        init: declarator.init,
                    },
                    scope,
                );
                if (declarator.init) this.#visit(declarator.init, scope);
            }
        });
    }

    /** Declares the names of a binding pattern, visiting defaults and types. */
    #pattern(
        pattern: Node,
        target: Scope,
        kind: BindingKind,
        node: Node,
        details: Partial<Declaration> = {},
        scope = target,
    ): void {
        switch (pattern.type) {
            case "Identifier":
                this.#declare(
                    target,
                    pattern,
                    pattern.name,
                    kind,
                    node,
                    details,
                );
                if (pattern.typeAnnotation)
                    this.#visit(pattern.typeAnnotation, scope, "type");
                return;
            case "ObjectPattern": {
                const rest = pattern.properties.some(
                    (property) => property.type === "RestElement",
                );
                for (const property of pattern.properties) {
                    if (property.type === "RestElement") {
                        this.#pattern(
                            property,
                            target,
                            kind,
                            node,
                            details,
                            scope,
                        );
                        continue;
                    }
                    if (property.type !== "Property") continue;
                    if (property.computed) this.#visit(property.key, scope);
                    this.#pattern(
                        property.value,
                        target,
                        kind,
                        node,
                        {
                            ...details,
                            restSibling: rest,
                        },
                        scope,
                    );
                }
                if (pattern.typeAnnotation)
                    this.#visit(pattern.typeAnnotation, scope, "type");
                return;
            }
            case "ArrayPattern":
                for (const element of pattern.elements)
                    if (element)
                        this.#pattern(
                            element,
                            target,
                            kind,
                            node,
                            details,
                            scope,
                        );
                if (pattern.typeAnnotation)
                    this.#visit(pattern.typeAnnotation, scope, "type");
                return;
            case "AssignmentPattern":
                this.#pattern(pattern.left, target, kind, node, details, scope);
                this.#visit(pattern.right, scope);
                return;
            case "RestElement":
                this.#pattern(
                    pattern.argument,
                    target,
                    kind,
                    node,
                    details,
                    scope,
                );
                if (pattern.typeAnnotation)
                    this.#visit(pattern.typeAnnotation, scope, "type");
                return;
            case "TSParameterProperty":
                this.#visitAll(pattern.decorators, scope);
                this.#pattern(
                    pattern.parameter,
                    target,
                    kind,
                    node,
                    details,
                    scope,
                );
                return;
            default:
                this.#visit(pattern, scope);
        }
    }

    /** Visits an assignment target, its identifiers are written. */
    #target(target: Node, scope: Scope, writer: Node, read: boolean): void {
        switch (target.type) {
            case "Identifier":
                this.#reference(target, target.name, scope, "value", {
                    read: read && !this.#discarded.has(writer),
                    write: true,
                    writer,
                });
                return;
            case "ObjectPattern":
                for (const property of target.properties) {
                    if (property.type === "RestElement")
                        this.#target(property.argument, scope, writer, false);
                    else if (property.type === "Property") {
                        if (property.computed) this.#visit(property.key, scope);
                        this.#target(property.value, scope, writer, false);
                    }
                }
                return;
            case "ArrayPattern":
                for (const element of target.elements)
                    if (element) this.#target(element, scope, writer, false);
                return;
            case "AssignmentPattern":
                this.#target(target.left, scope, writer, false);
                this.#visit(target.right, scope);
                return;
            case "RestElement":
                this.#target(target.argument, scope, writer, false);
                return;
            case "TSAsExpression":
            case "TSSatisfiesExpression":
            case "TSNonNullExpression":
            case "TSTypeAssertion":
                this.#target(target.expression, scope, writer, read);
                if ("typeAnnotation" in target)
                    this.#visit(target.typeAnnotation, scope, "type");
                return;
            default:
                this.#visit(target, scope);
        }
    }

    #function(
        node: NodeOf<
            | "ArrowFunctionExpression"
            | "FunctionDeclaration"
            | "FunctionExpression"
            | "TSDeclareFunction"
        >,
        scope: Scope,
    ): void {
        const inner = this.#scope("function", node, scope);
        if (node.type === "FunctionExpression" && node.id)
            this.#declare(inner, node.id, node.id.name, "function", node, {
                local: true,
            });
        this.#typeParameters(node.typeParameters, inner);
        for (const param of node.params)
            this.#pattern(param, inner, "parameter", node);
        if (node.returnType) this.#visit(node.returnType, inner, "type");
        if (!node.body) return;
        // like Biome, the body is a scope of its own, `var` there shadows parameters
        if (node.body.type === "BlockStatement")
            this.#visitAll(
                node.body.body,
                this.#scope("function", node.body, inner),
            );
        else this.#visit(node.body, inner);
    }

    #class(
        node: NodeOf<"ClassDeclaration" | "ClassExpression">,
        scope: Scope,
    ): void {
        this.#visitAll(node.decorators, scope);
        this.#ambiently(node.declare, () => {
            if (node.type === "ClassDeclaration" && node.id) {
                const binding = this.#declare(
                    scope,
                    node.id,
                    node.id.name,
                    "class",
                    node,
                );
                this.#inAmbient ||= Semantic.#ambientLast(binding);
            }

            const inner = this.#scope("class", node, scope);
            if (node.type === "ClassExpression" && node.id)
                this.#declare(inner, node.id, node.id.name, "class", node, {
                    local: true,
                });
            this.#typeParameters(node.typeParameters, inner);
            if (node.superClass) this.#visit(node.superClass, inner);
            if (node.superTypeArguments)
                this.#visit(node.superTypeArguments, inner, "type");
            this.#visitAll(node.implements, inner, "type");
            this.#visitAll(node.body.body, inner);
        });
    }

    #member(
        node: NodeOf<
            | "MethodDefinition"
            | "Property"
            | "PropertyDefinition"
            | "TSPropertySignature"
        >,
        scope: Scope,
    ): void {
        if ("decorators" in node) this.#visitAll(node.decorators, scope);
        if (node.computed) this.#visit(node.key, scope);
        if (
            node.type === "TSPropertySignature" ||
            node.type === "PropertyDefinition"
        ) {
            if (node.typeAnnotation)
                this.#visit(node.typeAnnotation, scope, "type");
            if (node.type === "PropertyDefinition" && node.value)
                this.#visit(node.value, scope);
            return;
        }
        this.#visit(node.value, scope);
    }

    #import(node: NodeOf<"ImportDeclaration">, scope: Scope): void {
        for (const specifier of node.specifiers) {
            if (
                specifier.type !== "ImportSpecifier" &&
                specifier.type !== "ImportDefaultSpecifier" &&
                specifier.type !== "ImportNamespaceSpecifier"
            )
                continue;
            this.#declare(
                scope,
                specifier.local,
                specifier.local.name,
                "import",
                specifier,
            );
        }
    }

    #exportNamed(node: NodeOf<"ExportNamedDeclaration">, scope: Scope): void {
        if (node.declaration) {
            this.#visit(node.declaration, scope);
            this.#exportDeclared(node.declaration, scope);
            return;
        }
        if (node.source) return;
        for (const specifier of node.specifiers)
            if (
                specifier.type === "ExportSpecifier" &&
                specifier.local.type === "Identifier"
            ) {
                this.#reference(
                    specifier.local,
                    specifier.local.name,
                    scope,
                    "value",
                    {
                        // exporting a type only name makes it a type reference
                        type:
                            node.exportKind === "type" ||
                            specifier.exportKind === "type",
                        read: true,
                    },
                );
                this.#exportReferenced(specifier.local);
            }
    }

    /** Marks the bindings a declaration declares as exported. */
    #exportDeclared(declaration: Node, scope: Scope): void {
        const ids: Node[] = [];
        if (declaration.type === "VariableDeclaration")
            for (const declarator of declaration.declarations)
                Semantic.#ids(declarator.id, ids);
        else if ("id" in declaration && declaration.id)
            ids.push(declaration.id);

        for (const id of ids) {
            const binding = this.#declared.get(id);
            if (
                binding?.scope === scope ||
                binding?.scope === Semantic.#hoisting(scope)
            )
                binding.exported = true;
        }
    }

    #exportReferenced(id: Node): void {
        const reference = this.#referenced.get(id);
        if (reference) this.#exports.push(reference);
    }

    static #ids(pattern: Node, ids: Node[]): void {
        switch (pattern.type) {
            case "Identifier":
                ids.push(pattern);
                return;
            case "ObjectPattern":
                for (const property of pattern.properties)
                    Semantic.#ids(
                        property.type === "Property"
                            ? property.value
                            : property,
                        ids,
                    );
                return;
            case "ArrayPattern":
                for (const element of pattern.elements)
                    if (element) Semantic.#ids(element, ids);
                return;
            case "AssignmentPattern":
                Semantic.#ids(pattern.left, ids);
                return;
            case "RestElement":
                Semantic.#ids(pattern.argument, ids);
        }
    }

    #loop(
        node: NodeOf<"ForInStatement" | "ForOfStatement" | "ForStatement">,
        scope: Scope,
    ): void {
        const inner = this.#scope("block", node, scope);
        if (node.type === "ForStatement") {
            if (node.init) this.#visit(node.init, inner);
            if (node.test) this.#visit(node.test, inner);
            if (node.update) {
                this.#discard(node.update);
                this.#visit(node.update, inner);
            }
        } else {
            if (node.left.type === "VariableDeclaration")
                this.#visit(node.left, inner);
            else this.#target(node.left, inner, node, false);
            this.#visit(node.right, inner);
        }
        this.#visit(node.body, inner);
    }

    /** Marks writes whose value is not used, like expression statements. */
    #discard(node: Node): void {
        if (node.type === "SequenceExpression")
            for (const expression of node.expressions)
                this.#discard(expression);
        else this.#discarded.add(node);
    }

    #namespace(node: NodeOf<"TSModuleDeclaration">, scope: Scope): void {
        this.#ambiently(node.declare, () => {
            let id = node.id;
            while (id.type === "TSQualifiedName") id = id.left;
            if (node.kind !== "global" && id.type === "Identifier")
                this.#declare(scope, id, id.name, "namespace", node);
            if (!node.body) return;
            const inner = this.#scope("module", node.body, scope);
            const ambient =
                node.kind === "global" || id.type === "StringLiteral";
            this.#ambiently(ambient, () =>
                this.#visitAll(node.body?.body ?? [], inner),
            );
        });
    }

    #jsx(node: NodeOf<"JSXElement">, scope: Scope): void {
        const name = node.name ?? "";
        const first = name.split(".")[0] ?? "";
        const intrinsic = !name.includes(".") && /^[a-z]|[-:]/.test(name);
        if (first && !intrinsic && first !== "this")
            this.#reference(node, first, scope, "value");
        if (node.typeArguments) this.#visit(node.typeArguments, scope, "type");
        this.#visitAll(node.attributes, scope);
        this.#visitAll(node.children, scope);
    }

    #typeParameters(
        parameters: NodeOf<"TSTypeParameterDeclaration"> | null,
        scope: Scope,
    ): void {
        if (!parameters) return;
        for (const parameter of parameters.params)
            this.#declare(
                scope,
                parameter,
                parameter.name,
                "typeParameter",
                parameter,
            );
        for (const parameter of parameters.params) {
            if (parameter.constraint)
                this.#visit(parameter.constraint, scope, "type");
            if (parameter.default)
                this.#visit(parameter.default, scope, "type");
        }
    }

    /** Parameters of signatures declare nothing, only their types are visited. */
    #signatureParameter(param: Node, scope: Scope): void {
        if ("typeAnnotation" in param && param.typeAnnotation)
            this.#visit(param.typeAnnotation, scope, "type");
        else if (param.type === "TSParameterProperty")
            this.#signatureParameter(param.parameter, scope);
        else if (param.type === "AssignmentPattern")
            this.#signatureParameter(param.left, scope);
    }

    /** The leftmost identifier of a qualified name is the reference. */
    #qualified(
        node: Node,
        scope: Scope,
        mode: Mode,
        flags: Partial<Reference> = {},
    ): void {
        let current = node;
        while (
            current.type === "TSQualifiedName" ||
            current.type === "MemberExpression"
        )
            current =
                current.type === "TSQualifiedName"
                    ? current.left
                    : current.object;
        if (current.type === "Identifier")
            this.#reference(current, current.name, scope, mode, flags);
        else if (
            current.type !== "ThisExpression" &&
            current.type !== "TSThisType"
        )
            this.#visit(current, scope, mode);
    }
}
