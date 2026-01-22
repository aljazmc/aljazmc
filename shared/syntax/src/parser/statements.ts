import type {
    BlockStatement,
    Decorator,
    Node,
    Program,
    StringLiteral,
    SwitchCase,
    TSEnumMember,
    VariableDeclaration,
} from "../ast.js";
import ExpressionParser from "./expressions.js";

/** Statements, modules and TypeScript declarations: the complete parser. */
export default class Parser extends ExpressionParser {
    parseProgram(): Program {
        const { body, directives } = this.#list(
            true,
            () => this.token.type === "eof",
        );
        if (this.token.type !== "eof") this.unexpected();
        return {
            type: "Program",
            start: 0,
            end: this.source.length,
            body,
            directives,
        };
    }

    /** Parses a whole document as one expression, for JSON. */
    parseDocument(): Node {
        const expression = this.parseAssignment();
        if (this.token.type !== "eof") this.unexpected();
        return expression;
    }

    parseBlock(): BlockStatement {
        const start = this.expect("{").start;
        const { body, directives } = this.#list(true, () => this.is("}"));
        this.expect("}");
        return this.finish("BlockStatement", start, { body, directives });
    }

    #list(
        directives: boolean,
        done: () => boolean,
    ): { body: Node[]; directives: Node[] } {
        const body: Node[] = [];
        const prologue: Node[] = [];
        let inPrologue = directives;

        while (!done() && this.token.type !== "eof") {
            if (inPrologue && this.token.type === "string") {
                const directive = this.attempt(() => {
                    const value = this.parseString();
                    if (!this.canInsertSemicolon()) this.unexpected();
                    this.semicolon();
                    return this.finish("Directive", value.start, { value });
                });
                if (directive) {
                    prologue.push(directive);
                    continue;
                }
            }
            inPrologue = false;
            body.push(this.#statement());
        }

        return { body, directives: prologue };
    }

    #statement(): Node {
        const start = this.token.start;
        const { type, value } = this.token;

        if (type === "punct") {
            if (value === "{") return this.parseBlock();
            if (value === ";") {
                this.next();
                return this.finish("EmptyStatement", start, {});
            }
            if (value === "@") {
                const decorators = this.parseDecorators();
                if (this.is("export")) return this.#export(start, decorators);
                const abstract = this.eat("abstract");
                return this.parseClass(
                    start,
                    decorators,
                    false,
                    abstract,
                    false,
                );
            }
        }

        if (type === "name") {
            const statement = this.#keyword(start, value);
            if (statement) return statement;
            if (this.is(":", this.peek())) {
                const label = this.parseIdentifier();
                this.next();
                return this.finish("LabeledStatement", start, {
                    label,
                    body: this.#statement(),
                });
            }
        }

        const expression = this.parseExpression();
        this.semicolon();
        return this.finish("ExpressionStatement", start, { expression });
    }

    #keyword(start: number, value: string): Node | undefined {
        const next = this.peek();
        const followedByName = this.isName(next) && !next.newline;

        switch (value) {
            case "var":
            case "const":
                if (value === "const" && this.is("enum", next))
                    return this.#declaration(start, false);
                return this.#variables(start, false);
            case "let":
                if (
                    this.isName(next) ||
                    this.is("[", next) ||
                    this.is("{", next)
                )
                    return this.#variables(start, false);
                return;
            case "using":
                if (followedByName) return this.#variables(start, false);
                return;
            case "function":
                return this.parseFunction(start, false, false);
            case "async":
                if (this.is("function", next) && !next.newline) {
                    this.next();
                    return this.parseFunction(start, true, false);
                }
                return;
            case "class":
                return this.parseClass(start, [], false, false, false);
            case "if":
                return this.#if(start);
            case "for":
                return this.#for(start);
            case "while": {
                this.next();
                const test = this.#parenthesized();
                return this.finish("WhileStatement", start, {
                    test,
                    body: this.#statement(),
                });
            }
            case "do": {
                this.next();
                const body = this.#statement();
                this.expect("while");
                const test = this.#parenthesized();
                this.eat(";");
                return this.finish("DoWhileStatement", start, { body, test });
            }
            case "return": {
                this.next();
                const argument = this.canInsertSemicolon()
                    ? null
                    : this.parseExpression();
                this.semicolon();
                return this.finish("ReturnStatement", start, { argument });
            }
            case "throw": {
                this.next();
                const argument = this.parseExpression();
                this.semicolon();
                return this.finish("ThrowStatement", start, { argument });
            }
            case "break":
            case "continue": {
                this.next();
                const label =
                    !this.canInsertSemicolon() && this.isName()
                        ? this.parseIdentifier()
                        : null;
                this.semicolon();
                return this.finish(
                    value === "break" ? "BreakStatement" : "ContinueStatement",
                    start,
                    { label },
                );
            }
            case "debugger":
                this.next();
                this.semicolon();
                return this.finish("DebuggerStatement", start, {});
            case "try":
                return this.#try(start);
            case "switch":
                return this.#switch(start);
            case "with": {
                this.next();
                const object = this.#parenthesized();
                return this.finish("WithStatement", start, {
                    object,
                    body: this.#statement(),
                });
            }
            case "import":
                if (this.is("(", next) || this.is(".", next)) return;
                return this.#import(start);
            case "export":
                return this.#export(start, []);
        }

        if (this.options.typescript) return this.#declaration(start, false);
        return undefined;
    }

    /** TypeScript declarations, undefined when the word is used as a name. */
    #declaration(start: number, declare: boolean): Node | undefined {
        const next = this.peek();
        const sameLine = !next.newline;

        switch (this.token.value) {
            case "interface":
                if (!this.isName(next) || !sameLine) return;
                return this.#interface(start, declare);
            case "type":
                if (!this.isName(next) || !sameLine) return;
                return this.#typeAlias(start, declare);
            case "enum":
                if (!this.isName(next)) return;
                return this.#enum(start, false, declare);
            case "const":
                if (!this.is("enum", next))
                    return this.#variables(start, declare);
                this.next();
                return this.#enum(start, true, declare);
            case "namespace":
            case "module":
                if (
                    !sameLine ||
                    !(
                        this.isName(next) ||
                        (this.token.value === "module" &&
                            next.type === "string")
                    )
                )
                    return;
                return this.#module(start, declare);
            case "global":
                if (!this.is("{", next)) return;
                return this.#module(start, declare);
            case "abstract":
                if (!this.is("class", next) || !sameLine) return;
                this.next();
                return this.parseClass(start, [], false, true, declare);
            case "declare": {
                if (!sameLine || !(this.isName(next) || this.is("@", next)))
                    return;
                this.next();
                const declared = this.#declared(start);
                return declared;
            }
        }
        return undefined;
    }

    #declared(start: number): Node {
        switch (this.token.value) {
            case "var":
            case "let":
            case "using":
                return this.#variables(start, true);
            case "function": {
                const fn = this.parseFunction(start, false, false);
                return {
                    ...fn,
                    type: "TSDeclareFunction",
                    declare: true,
                    body: null,
                } as Node;
            }
            case "async": {
                this.next();
                const fn = this.parseFunction(start, true, false);
                return {
                    ...fn,
                    type: "TSDeclareFunction",
                    declare: true,
                    body: null,
                } as Node;
            }
            case "class":
                return this.parseClass(start, [], false, false, true);
        }
        const declaration = this.#declaration(start, true);
        if (!declaration) this.unexpected("Expected a declaration");
        return declaration;
    }

    #variables(start: number, declare: boolean): VariableDeclaration {
        const declaration = this.parseVariables(start, declare);
        this.semicolon();
        declaration.end = this.previous;
        return declaration;
    }

    parseVariables(start: number, declare: boolean): VariableDeclaration {
        const kind = this.next().value;
        const declarations: VariableDeclaration["declarations"] = [];
        do {
            const declaratorStart = this.token.start;
            const id = this.parseBindingTarget();
            const definite = this.eat("!");
            if (this.is(":")) {
                id.typeAnnotation = this.parseTypeAnnotation();
                id.end = this.previous;
            }
            const init = this.eat("=") ? this.parseAssignment() : null;
            declarations.push(
                this.finish("VariableDeclarator", declaratorStart, {
                    id,
                    init,
                    definite,
                }),
            );
        } while (this.eat(","));
        return this.finish("VariableDeclaration", start, {
            kind,
            declarations,
            declare,
        });
    }

    #parenthesized(): Node {
        this.expect("(");
        const expression = this.withIn(true, () => this.parseExpression());
        this.expect(")");
        return expression;
    }

    #if(start: number): Node {
        this.next();
        const test = this.#parenthesized();
        const consequent = this.#statement();
        const alternate = this.eat("else") ? this.#statement() : null;
        return this.finish("IfStatement", start, {
            test,
            consequent,
            alternate,
        });
    }

    #for(start: number): Node {
        this.next();
        const awaits = this.eat("await");
        this.expect("(");

        let init: Node | null = null;
        if (!this.is(";")) {
            const initStart = this.token.start;
            const declares =
                ["var", "const"].includes(this.token.value) ||
                (["let", "using"].includes(this.token.value) &&
                    (this.isName(this.peek()) ||
                        this.is("[", this.peek()) ||
                        this.is("{", this.peek())));
            init = this.withIn(false, () =>
                declares
                    ? this.parseVariables(initStart, false)
                    : this.parseExpression(),
            );
        }

        if (init && (this.is("of") || this.is("in"))) {
            if (init.type !== "VariableDeclaration")
                init = this.toPattern(init);
            const of = this.next().value === "of";
            const right = this.withIn(true, () =>
                of ? this.parseAssignment() : this.parseExpression(),
            );
            this.expect(")");
            const body = this.#statement();
            return of
                ? this.finish("ForOfStatement", start, {
                      left: init,
                      right,
                      body,
                      await: awaits,
                  })
                : this.finish("ForInStatement", start, {
                      left: init,
                      right,
                      body,
                  });
        }

        this.expect(";");
        const test = this.is(";")
            ? null
            : this.withIn(true, () => this.parseExpression());
        this.expect(";");
        const update = this.is(")")
            ? null
            : this.withIn(true, () => this.parseExpression());
        this.expect(")");
        return this.finish("ForStatement", start, {
            init,
            test,
            update,
            body: this.#statement(),
        });
    }

    #try(start: number): Node {
        this.next();
        const block = this.parseBlock();
        let handler = null;
        if (this.is("catch")) {
            const handlerStart = this.next().start;
            let param: Node | null = null;
            if (this.eat("(")) {
                const target = this.parseBindingTarget();
                if (this.is(":")) {
                    target.typeAnnotation = this.parseTypeAnnotation();
                    target.end = this.previous;
                }
                param = target;
                this.expect(")");
            }
            handler = this.finish("CatchClause", handlerStart, {
                param,
                body: this.parseBlock(),
            });
        }
        const finalizer = this.eat("finally") ? this.parseBlock() : null;
        return this.finish("TryStatement", start, {
            block,
            handler,
            finalizer,
        });
    }

    #switch(start: number): Node {
        this.next();
        const discriminant = this.#parenthesized();
        this.expect("{");
        const cases: SwitchCase[] = [];
        while (!this.is("}")) {
            const caseStart = this.token.start;
            let test: Node | null = null;
            if (this.eat("case"))
                test = this.withIn(true, () => this.parseExpression());
            else this.expect("default");
            this.expect(":");
            const consequent: Node[] = [];
            while (!this.is("case") && !this.is("default") && !this.is("}"))
                consequent.push(this.#statement());
            cases.push(
                this.finish("SwitchCase", caseStart, { test, consequent }),
            );
        }
        this.expect("}");
        return this.finish("SwitchStatement", start, { discriminant, cases });
    }

    // Modules

    #import(start: number): Node {
        this.expect("import");

        let importKind: "type" | "typeof" | "value" = "value";
        const next = this.peek();
        if (
            this.is("type") &&
            (this.is("{", next) ||
                this.is("*", next) ||
                (this.isName(next) && !this.is("from", next)) ||
                (this.is("from", next) && this.isName(this.#peekTwo())))
        )
            importKind = this.next().value as "type";

        let phase: string | null = null;
        if (
            (this.is("defer") || this.is("source")) &&
            (this.isName(this.peek()) || this.is("*", this.peek())) &&
            !this.is("from", this.peek())
        )
            phase = this.next().value;

        if (this.token.type === "string") {
            const source = this.parseString();
            const attributes = this.#attributes();
            this.semicolon();
            return this.finish("ImportDeclaration", start, {
                specifiers: [],
                source,
                attributes,
                importKind,
                phase,
            });
        }

        const specifiers: Node[] = [];
        if (this.isName() && !this.is("from")) {
            const local = this.parseIdentifier();
            if (this.is("="))
                return this.#importEquals(start, local, importKind, false);
            specifiers.push(
                this.finish("ImportDefaultSpecifier", local.start, { local }),
            );
            this.eat(",");
        } else if (
            this.isName() &&
            this.is("from") &&
            this.is("=", this.peek())
        ) {
            const local = this.parseIdentifier();
            return this.#importEquals(start, local, importKind, false);
        } else if (
            this.isName() &&
            this.is("from") &&
            this.isName(this.peek())
        ) {
            const local = this.parseIdentifier();
            specifiers.push(
                this.finish("ImportDefaultSpecifier", local.start, { local }),
            );
        }

        if (this.is("*")) {
            const namespaceStart = this.next().start;
            this.expect("as");
            const local = this.parseIdentifier();
            specifiers.push(
                this.finish("ImportNamespaceSpecifier", namespaceStart, {
                    local,
                }),
            );
        } else if (this.is("{")) {
            this.next();
            while (!this.is("}")) {
                const specifierStart = this.token.start;
                let kind: "type" | "value" = "value";
                if (this.#typeModifier()) {
                    this.next();
                    kind = "type";
                }
                const imported = this.#moduleName();
                const local = this.eat("as")
                    ? this.parseIdentifier()
                    : (imported as never);
                specifiers.push(
                    this.finish("ImportSpecifier", specifierStart, {
                        imported,
                        local,
                        importKind: kind,
                    }),
                );
                if (!this.eat(",")) break;
            }
            this.expect("}");
        }

        this.expect("from");
        const source = this.parseString();
        const attributes = this.#attributes();
        this.semicolon();
        return this.finish("ImportDeclaration", start, {
            specifiers,
            source,
            attributes,
            importKind,
            phase,
        });
    }

    /** A module export name: an identifier or a string. */
    #moduleName(): Node {
        return this.token.type === "string"
            ? this.parseString()
            : this.parseIdentifier();
    }

    /** Whether `type` modifies the following specifier, as in `{ type A }`. */
    #typeModifier(): boolean {
        const next = this.peek();
        return (
            this.is("type") &&
            (this.isName(next) || next.type === "string") &&
            !this.is("as", next)
        );
    }

    #peekTwo(): typeof this.token {
        const snapshot = this.snapshot();
        this.next();
        this.next();
        const token = this.token;
        this.restore(snapshot);
        return token;
    }

    #importEquals(
        start: number,
        id: Node & { type: "Identifier" },
        importKind: "type" | "typeof" | "value",
        isExport: boolean,
    ): Node {
        this.expect("=");
        let moduleReference: Node;
        if (this.is("require") && this.is("(", this.peek())) {
            const referenceStart = this.next().start;
            this.expect("(");
            const expression = this.parseString();
            this.expect(")");
            moduleReference = this.finish(
                "TSExternalModuleReference",
                referenceStart,
                { expression },
            );
        } else moduleReference = this.parseEntityName();
        this.semicolon();
        return this.finish("TSImportEqualsDeclaration", start, {
            id,
            moduleReference,
            importKind: importKind === "type" ? "type" : "value",
            isExport,
        });
    }

    #attributes(): Node[] {
        if (this.token.newline || !(this.is("with") || this.is("assert")))
            return [];
        this.next();
        this.expect("{");
        const attributes: Node[] = [];
        while (!this.is("}")) {
            const start = this.token.start;
            const key = this.#moduleName();
            this.expect(":");
            const value = this.parseString();
            attributes.push(
                this.finish("ImportAttribute", start, { key, value }),
            );
            if (!this.eat(",")) break;
        }
        this.expect("}");
        return attributes;
    }

    #export(start: number, decorators: Decorator[]): Node {
        this.expect("export");

        if (this.is("=")) {
            this.next();
            const expression = this.parseExpression();
            this.semicolon();
            return this.finish("TSExportAssignment", start, { expression });
        }
        if (this.is("as") && this.is("namespace", this.peek())) {
            this.next();
            this.next();
            const id = this.parseIdentifier();
            this.semicolon();
            return this.finish("TSNamespaceExportDeclaration", start, { id });
        }
        if (this.is("import") && this.isName(this.peek())) {
            this.next();
            let kind: "type" | "value" = "value";
            if (
                this.is("type") &&
                this.isName(this.peek()) &&
                !this.is("=", this.peek())
            ) {
                this.next();
                kind = "type";
            }
            const id = this.parseIdentifier();
            return this.#importEquals(start, id, kind, true);
        }

        if (this.is("default")) {
            this.next();
            const declarationStart = this.token.start;
            let declaration: Node;
            if (this.is("function"))
                declaration = this.#defaultFunction(declarationStart, false);
            else if (
                this.is("async") &&
                this.is("function", this.peek()) &&
                !this.peek().newline
            ) {
                this.next();
                declaration = this.#defaultFunction(declarationStart, true);
            } else if (this.is("class"))
                declaration = this.parseClass(
                    declarationStart,
                    decorators,
                    false,
                    false,
                    false,
                );
            else if (this.is("@")) {
                const classDecorators = this.parseDecorators();
                declaration = this.parseClass(
                    declarationStart,
                    classDecorators,
                    false,
                    false,
                    false,
                );
            } else if (this.is("abstract") && this.is("class", this.peek())) {
                this.next();
                declaration = this.parseClass(
                    declarationStart,
                    decorators,
                    false,
                    true,
                    false,
                );
            } else if (this.is("interface") && this.isName(this.peek())) {
                declaration = this.#interface(declarationStart, false);
            } else {
                declaration = this.parseAssignment();
                this.semicolon();
            }
            return this.finish("ExportDefaultDeclaration", start, {
                declaration,
            });
        }

        let exportKind: "type" | "value" = "value";
        if (
            this.is("type") &&
            (this.is("{", this.peek()) || this.is("*", this.peek()))
        ) {
            this.next();
            exportKind = "type";
        }

        if (this.is("*")) {
            this.next();
            const exported = this.eat("as") ? this.#moduleName() : null;
            this.expect("from");
            const source = this.parseString();
            const attributes = this.#attributes();
            this.semicolon();
            return this.finish("ExportAllDeclaration", start, {
                exported,
                source,
                attributes,
                exportKind,
            });
        }

        if (this.is("{")) {
            this.next();
            const specifiers: Node[] = [];
            while (!this.is("}")) {
                const specifierStart = this.token.start;
                let kind: "type" | "value" = "value";
                if (this.#typeModifier()) {
                    this.next();
                    kind = "type";
                }
                const local = this.#moduleName();
                const exported = this.eat("as") ? this.#moduleName() : local;
                specifiers.push(
                    this.finish("ExportSpecifier", specifierStart, {
                        local,
                        exported,
                        exportKind: kind,
                    }),
                );
                if (!this.eat(",")) break;
            }
            this.expect("}");
            let source: StringLiteral | null = null;
            let attributes: Node[] = [];
            if (this.eat("from")) {
                source = this.parseString();
                attributes = this.#attributes();
            }
            this.semicolon();
            return this.finish("ExportNamedDeclaration", start, {
                declaration: null,
                specifiers,
                source,
                attributes,
                exportKind,
            });
        }

        const declarationStart = this.token.start;
        let declaration: Node | undefined;
        if (this.is("@")) {
            const classDecorators = this.parseDecorators();
            declaration = this.parseClass(
                declarationStart,
                classDecorators,
                false,
                this.eat("abstract"),
                false,
            );
        } else if (this.is("class"))
            declaration = this.parseClass(
                declarationStart,
                decorators,
                false,
                false,
                false,
            );
        else
            declaration =
                this.#keyword(declarationStart, this.token.value) ??
                this.#declaration(declarationStart, false);
        if (!declaration) this.unexpected("Expected a declaration");
        if (
            declaration.type === "ClassDeclaration" &&
            decorators.length > 0 &&
            declaration.decorators.length === 0
        )
            declaration.decorators = decorators;
        return this.finish("ExportNamedDeclaration", start, {
            declaration,
            specifiers: [],
            source: null,
            attributes: [],
            exportKind: "value",
        });
    }

    #defaultFunction(start: number, async: boolean): Node {
        this.expect("function");
        const generator = this.eat("*");
        const id =
            this.isName() && !this.is("(") ? this.parseIdentifier() : null;
        const typeParameters = this.parseTypeParameters();
        const params = this.parseParameters();
        const returnType = this.eat(":") ? this.parseReturnType() : null;
        const parts = {
            id,
            params,
            async,
            generator,
            typeParameters,
            returnType,
        };
        if (!this.is("{")) {
            this.semicolon();
            return this.finish("TSDeclareFunction", start, {
                ...parts,
                body: null,
                declare: false,
            });
        }
        return this.finish("FunctionDeclaration", start, {
            ...parts,
            body: this.parseBlock(),
            declare: false,
        });
    }

    // TypeScript declarations

    #interface(start: number, declare: boolean): Node {
        this.expect("interface");
        const id = this.parseIdentifier();
        const typeParameters = this.parseTypeParameters();
        const extended: Node[] = [];
        if (this.eat("extends")) {
            do extended.push(this.parseType());
            while (this.eat(","));
        }
        const bodyStart = this.token.start;
        const members = this.parseTypeMembers();
        const body = this.finish("TSInterfaceBody", bodyStart, {
            body: members,
        });
        return this.finish("TSInterfaceDeclaration", start, {
            id,
            typeParameters,
            extends: extended,
            body,
            declare,
        });
    }

    #typeAlias(start: number, declare: boolean): Node {
        this.expect("type");
        const id = this.parseIdentifier();
        const typeParameters = this.parseTypeParameters();
        this.expect("=");
        const typeAnnotation = this.parseType();
        this.semicolon();
        return this.finish("TSTypeAliasDeclaration", start, {
            id,
            typeParameters,
            typeAnnotation,
            declare,
        });
    }

    #enum(start: number, isConst: boolean, declare: boolean): Node {
        this.expect("enum");
        const id = this.parseIdentifier();
        this.expect("{");
        const members: TSEnumMember[] = [];
        while (!this.is("}")) {
            const memberStart = this.token.start;
            const { key } = this.parsePropertyKey();
            const initializer = this.eat("=") ? this.parseAssignment() : null;
            members.push(
                this.finish("TSEnumMember", memberStart, {
                    id: key,
                    initializer,
                }),
            );
            if (!this.eat(",")) break;
        }
        this.expect("}");
        return this.finish("TSEnumDeclaration", start, {
            id,
            members,
            const: isConst,
            declare,
        });
    }

    #module(start: number, declare: boolean): Node {
        const keyword = this.next().value;
        const kind =
            keyword === "global"
                ? "global"
                : keyword === "module"
                  ? "module"
                  : "namespace";
        let id: Node;
        if (kind === "global")
            id = this.finish("Identifier", start, { name: "global" });
        else if (this.token.type === "string") id = this.parseString();
        else id = this.parseEntityName();

        if (!this.is("{")) {
            this.semicolon();
            return this.finish("TSModuleDeclaration", start, {
                id,
                body: null,
                kind,
                declare,
            });
        }

        const bodyStart = this.expect("{").start;
        const { body } = this.#list(false, () => this.is("}"));
        this.expect("}");
        const block = this.finish("TSModuleBlock", bodyStart, { body });
        return this.finish("TSModuleDeclaration", start, {
            id,
            body: block,
            kind,
            declare,
        });
    }
}
