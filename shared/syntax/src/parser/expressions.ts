import type {
    BlockStatement,
    ClassBody,
    Decorator,
    FunctionExpression,
    JSXElement,
    Node,
    TypeArguments,
} from "../ast.js";
import TypeParser from "./types.js";

/** Expressions, patterns, functions, classes and JSX. */
export default abstract class ExpressionParser extends TypeParser {
    static readonly #precedence: Record<string, number> = {
        "??": 1,
        "||": 2,
        "&&": 3,
        "|": 4,
        "^": 5,
        "&": 6,
        "==": 7,
        "!=": 7,
        "===": 7,
        "!==": 7,
        "<": 8,
        ">": 8,
        "<=": 8,
        ">=": 8,
        instanceof: 8,
        in: 8,
        as: 8,
        satisfies: 8,
        "<<": 9,
        ">>": 9,
        ">>>": 9,
        "+": 10,
        "-": 10,
        "*": 11,
        "/": 11,
        "%": 11,
        "**": 12,
    };

    static readonly #assignments = new Set([
        "=",
        "+=",
        "-=",
        "*=",
        "/=",
        "%=",
        "**=",
        "<<=",
        ">>=",
        ">>>=",
        "&=",
        "|=",
        "^=",
        "&&=",
        "||=",
        "??=",
    ]);

    static readonly #modifiers = new Set([
        "abstract",
        "accessor",
        "async",
        "declare",
        "override",
        "private",
        "protected",
        "public",
        "readonly",
        "static",
    ]);

    /** Tokens after `f<T>` that make it an instantiation, not a comparison. */
    static readonly #afterTypeArguments = new Set([
        ")",
        "]",
        "}",
        ",",
        ";",
        ".",
        "?.",
        ":",
        "=",
        "==",
        "===",
        "!=",
        "!==",
        "&&",
        "||",
        "??",
        "?",
        "{",
        "extends",
        "implements",
    ]);

    abstract parseBlock(): BlockStatement;

    parseExpression(): Node {
        const start = this.token.start;
        const first = this.parseAssignment();
        if (!this.is(",")) return first;
        const expressions = [first];
        while (this.eat(",")) expressions.push(this.parseAssignment());
        return this.finish("SequenceExpression", start, { expressions });
    }

    parseAssignment(): Node {
        const start = this.token.start;

        if (this.is("yield") && this.#yields()) return this.#yield(start);

        const arrow = this.#tryArrow(start);
        if (arrow) return arrow;

        const left = this.#conditional(start);
        if (this.token.type === "punct" && this.is(">"))
            this.replace(this.scanner.greater(this.token));
        if (this.token.type === "punct" && this.is("<"))
            this.replace(this.scanner.less(this.token));
        if (
            this.token.type !== "punct" ||
            !ExpressionParser.#assignments.has(this.token.value)
        )
            return left;

        const operator = this.next().value;
        const right = this.parseAssignment();
        return this.finish("AssignmentExpression", start, {
            operator,
            left: operator === "=" ? this.toPattern(left) : left,
            right,
        });
    }

    /** Converts an object or array literal used as an assignment target into a pattern. */
    toPattern(node: Node): Node {
        switch (node.type) {
            case "ObjectExpression":
                return {
                    ...node,
                    type: "ObjectPattern",
                    typeAnnotation: null,
                    properties: node.properties.map((property) => {
                        if (property.type === "SpreadElement")
                            return {
                                ...property,
                                type: "RestElement",
                                argument: this.toPattern(property.argument),
                                typeAnnotation: null,
                            };
                        if (property.type === "Property" && !property.shorthand)
                            return {
                                ...property,
                                value: this.toPattern(property.value),
                            };
                        return property;
                    }),
                } as Node;
            case "ArrayExpression":
                return {
                    ...node,
                    type: "ArrayPattern",
                    typeAnnotation: null,
                    elements: node.elements.map((element) => {
                        if (!element) return element;
                        if (element.type === "SpreadElement")
                            return {
                                ...element,
                                type: "RestElement",
                                argument: this.toPattern(element.argument),
                                typeAnnotation: null,
                            };
                        return this.toPattern(element);
                    }),
                } as Node;
            case "AssignmentExpression":
                return node.operator === "="
                    ? ({
                          ...node,
                          type: "AssignmentPattern",
                          left: this.toPattern(node.left),
                      } as Node)
                    : node;
            default:
                return node;
        }
    }

    /** Parses with `in` allowed or not, restoring the previous setting. */
    protected withIn<T>(allow: boolean, parse: () => T): T {
        const allowIn = this.allowIn;
        this.allowIn = allow;
        try {
            return parse();
        } finally {
            this.allowIn = allowIn;
        }
    }

    #yields(): boolean {
        const next = this.peek();
        return !next.newline || next.value === "*";
    }

    #yield(start: number): Node {
        this.next();
        const delegate = this.eat("*");
        const argument =
            delegate || (!this.token.newline && !this.#ends())
                ? this.parseAssignment()
                : null;
        return this.finish("YieldExpression", start, { argument, delegate });
    }

    /** Whether the current token cannot start an expression. */
    #ends(): boolean {
        return (
            [")", "]", "}", ",", ";", ":", "=>"].includes(this.token.value) ||
            this.token.type === "eof"
        );
    }

    #tryArrow(start: number): Node | undefined {
        const next =
            this.isName() || this.is("(") || this.is("<")
                ? this.peek()
                : undefined;
        if (!next) return;

        if (
            this.is("async") &&
            !next.newline &&
            (this.isName(next) || this.is("(", next) || this.is("<", next))
        ) {
            const arrow = this.attempt(() => {
                this.next();
                return this.#arrow(start, true);
            });
            if (arrow) return arrow;
        }

        if (this.isName() && this.is("=>", next) && !next.newline)
            return this.#arrow(start, false);
        if (this.is("(") || (this.is("<") && this.options.typescript))
            return this.attempt(() => this.#arrow(start, false));
    }

    #arrow(start: number, async: boolean): Node {
        let typeParameters = null;
        let params: Node[];
        let returnType: Node | null = null;

        if (this.isName() && !this.is("(")) params = [this.parseIdentifier()];
        else {
            typeParameters = this.parseTypeParameters();
            params = this.parseParameters();
            if (this.eat(":")) returnType = this.parseReturnType();
        }

        if (this.token.newline || !this.is("=>"))
            this.unexpected('Expected "=>"');
        this.next();
        const body = this.is("{") ? this.parseBlock() : this.parseAssignment();
        return this.finish("ArrowFunctionExpression", start, {
            id: null,
            params,
            body,
            async,
            generator: false,
            typeParameters,
            returnType,
        });
    }

    #conditional(start: number): Node {
        const test = this.#binary(0);
        if (!this.is("?")) return test;
        this.next();
        const consequent = this.withIn(true, () => this.parseAssignment());
        this.expect(":");
        const alternate = this.parseAssignment();
        return this.finish("ConditionalExpression", start, {
            test,
            consequent,
            alternate,
        });
    }

    #binary(minimum: number): Node {
        const start = this.token.start;
        let left = this.#unary();

        for (;;) {
            if (this.is(">")) this.replace(this.scanner.greater(this.token));
            else if (this.is("<") && this.token.type === "punct")
                this.replace(this.scanner.less(this.token));
            const { value, type } = this.token;
            const precedence = ExpressionParser.#precedence[value];

            if (
                precedence === undefined ||
                (type !== "punct" && type !== "name")
            )
                break;
            if (
                type === "name" &&
                !["in", "instanceof", "as", "satisfies"].includes(value)
            )
                break;
            if (value === "in" && !this.allowIn) break;
            if (
                (value === "as" || value === "satisfies") &&
                (this.token.newline || !this.options.typescript)
            )
                break;
            if (value === "**" ? precedence < minimum : precedence <= minimum)
                break;

            this.next();
            if (value === "as" || value === "satisfies") {
                const typeAnnotation = this.is("const")
                    ? this.#constType()
                    : this.parseType();
                left = this.finish(
                    value === "as" ? "TSAsExpression" : "TSSatisfiesExpression",
                    start,
                    { expression: left, typeAnnotation },
                );
                continue;
            }

            const right = this.#binary(precedence);
            const logical = value === "&&" || value === "||" || value === "??";
            left = this.finish(
                logical ? "LogicalExpression" : "BinaryExpression",
                start,
                { operator: value, left, right },
            );
        }

        return left;
    }

    #constType(): Node {
        const start = this.token.start;
        const typeName = this.parseIdentifier();
        return this.finish("TSTypeReference", start, {
            typeName,
            typeArguments: null,
        });
    }

    #unary(): Node {
        const start = this.token.start;
        const { value, type } = this.token;

        if (type === "punct" && ["!", "~", "+", "-"].includes(value)) {
            this.next();
            return this.finish("UnaryExpression", start, {
                operator: value,
                argument: this.#unary(),
            });
        }
        if (
            type === "name" &&
            ["typeof", "void", "delete"].includes(value) &&
            !this.#keywordEnds()
        ) {
            this.next();
            return this.finish("UnaryExpression", start, {
                operator: value,
                argument: this.#unary(),
            });
        }
        if (type === "punct" && (value === "++" || value === "--")) {
            this.next();
            return this.finish("UpdateExpression", start, {
                operator: value,
                prefix: true,
                argument: this.#unary(),
            });
        }
        if (this.is("await") && !this.#keywordEnds()) {
            this.next();
            return this.finish("AwaitExpression", start, {
                argument: this.#unary(),
            });
        }
        if (this.is("<") && this.options.typescript && !this.options.jsx) {
            this.next();
            const typeAnnotation = this.is("const")
                ? this.#constType()
                : this.parseType();
            this.expect(">");
            return this.finish("TSTypeAssertion", start, {
                typeAnnotation,
                expression: this.#unary(),
            });
        }

        const argument = this.parseLeftHandSide();
        if (!this.token.newline && (this.is("++") || this.is("--"))) {
            const operator = this.next().value;
            return this.finish("UpdateExpression", start, {
                operator,
                prefix: false,
                argument,
            });
        }
        return argument;
    }

    /** Whether a keyword like `await` is used as a plain name here. */
    #keywordEnds(): boolean {
        const next = this.peek();
        return (
            [")", "]", "}", ",", ";", ":", "=", ".", "?.", "=>", "?"].includes(
                next.value,
            ) ||
            next.type === "eof" ||
            (next.type === "punct" &&
                ExpressionParser.#assignments.has(next.value))
        );
    }

    parseLeftHandSide(): Node {
        const start = this.token.start;
        const expression = this.is("new") ? this.#new() : this.#primary();
        return this.#subscripts(expression, start, false);
    }

    #subscripts(object: Node, start: number, noCall: boolean): Node {
        let expression = object;

        for (;;) {
            if (this.eat(".")) {
                expression = this.finish("MemberExpression", start, {
                    object: expression,
                    property: this.#memberName(),
                    computed: false,
                    optional: false,
                });
            } else if (this.is("?.")) {
                if (noCall) break;
                this.next();
                if (this.is("("))
                    expression = this.#call(start, expression, null, true);
                else if (this.eat("[")) {
                    const property = this.withIn(true, () =>
                        this.parseExpression(),
                    );
                    this.expect("]");
                    expression = this.finish("MemberExpression", start, {
                        object: expression,
                        property,
                        computed: true,
                        optional: true,
                    });
                } else if (this.is("<")) {
                    const typeArguments = this.parseTypeArguments();
                    expression = this.#call(
                        start,
                        expression,
                        typeArguments,
                        true,
                    );
                } else
                    expression = this.finish("MemberExpression", start, {
                        object: expression,
                        property: this.#memberName(),
                        computed: false,
                        optional: true,
                    });
            } else if (this.is("[")) {
                this.next();
                const property = this.withIn(true, () =>
                    this.parseExpression(),
                );
                this.expect("]");
                expression = this.finish("MemberExpression", start, {
                    object: expression,
                    property,
                    computed: true,
                    optional: false,
                });
            } else if (!noCall && this.is("(")) {
                expression = this.#call(start, expression, null, false);
            } else if (this.token.type === "template") {
                const quasi = this.#template();
                expression = this.finish("TaggedTemplateExpression", start, {
                    tag: expression,
                    quasi,
                    typeArguments: null,
                });
            } else if (
                this.options.typescript &&
                this.is("!") &&
                !this.token.newline
            ) {
                this.next();
                expression = this.finish("TSNonNullExpression", start, {
                    expression,
                });
            } else if (
                this.options.typescript &&
                this.is("<") &&
                !this.token.newline
            ) {
                const result = this.attempt(() =>
                    this.#typeArgumentsSubscript(start, expression, noCall),
                );
                if (!result) break;
                expression = result;
            } else break;
        }

        return expression;
    }

    #typeArgumentsSubscript(
        start: number,
        expression: Node,
        noCall: boolean,
    ): Node {
        const typeArguments = this.parseTypeArguments();
        if (!noCall && this.is("("))
            return this.#call(start, expression, typeArguments, false);
        if (this.token.type === "template") {
            const quasi = this.#template();
            return this.finish("TaggedTemplateExpression", start, {
                tag: expression,
                quasi,
                typeArguments,
            });
        }
        if (
            this.token.type === "eof" ||
            this.token.newline ||
            (ExpressionParser.#afterTypeArguments.has(this.token.value) &&
                this.token.type !== "string")
        )
            return this.finish("TSInstantiationExpression", start, {
                expression,
                typeArguments,
            });
        return this.unexpected();
    }

    #memberName(): Node {
        if (this.token.type === "private") {
            const { start, value } = this.next();
            return this.finish("PrivateName", start, { name: value.slice(1) });
        }
        return this.parseIdentifier();
    }

    #call(
        start: number,
        callee: Node,
        typeArguments: TypeArguments | null,
        optional: boolean,
    ): Node {
        const args = this.parseArguments();
        return this.finish("CallExpression", start, {
            callee,
            arguments: args,
            optional,
            typeArguments,
        });
    }

    parseArguments(): Node[] {
        this.expect("(");
        const args: Node[] = [];
        while (!this.is(")")) {
            const start = this.token.start;
            if (this.eat("..."))
                args.push(
                    this.finish("SpreadElement", start, {
                        argument: this.withIn(true, () =>
                            this.parseAssignment(),
                        ),
                    }),
                );
            else args.push(this.withIn(true, () => this.parseAssignment()));
            if (!this.eat(",")) break;
        }
        this.expect(")");
        return args;
    }

    #new(): Node {
        const start = this.expect("new").start;
        if (this.eat(".")) {
            const property = this.parseIdentifier().name;
            return this.finish("MetaProperty", start, {
                meta: "new",
                property,
            });
        }

        const calleeStart = this.token.start;
        const inner = this.is("new") ? this.#new() : this.#primary();
        let callee = this.#subscripts(inner, calleeStart, true);
        let typeArguments: TypeArguments | null = null;
        if (callee.type === "TSInstantiationExpression") {
            typeArguments = callee.typeArguments;
            callee = callee.expression;
        } else if (this.options.typescript && this.is("<")) {
            typeArguments =
                this.attempt(() => this.parseTypeArguments()) ?? null;
        }
        const parentheses = this.is("(");
        const args = parentheses ? this.parseArguments() : [];
        return this.finish("NewExpression", start, {
            callee,
            arguments: args,
            typeArguments,
            parentheses,
        });
    }

    #primary(): Node {
        const token = this.token;
        const { start, type, value } = token;

        switch (type) {
            case "number":
                this.next();
                return this.finish("NumericLiteral", start, { raw: value });
            case "string":
                this.next();
                return this.finish("StringLiteral", start, { raw: value });
            case "template":
                return this.#template();
            case "private":
                this.next();
                return this.finish("PrivateName", start, {
                    name: value.slice(1),
                });
            case "punct":
                return this.#punctuation(start, value);
            case "name":
                return this.#word(start, value);
            default:
                return this.unexpected();
        }
    }

    #punctuation(start: number, value: string): Node {
        switch (value) {
            case "(": {
                this.next();
                const expression = this.withIn(true, () =>
                    this.parseExpression(),
                );
                this.expect(")");
                expression.parenthesized = true;
                return expression;
            }
            case "[":
                return this.#array(start);
            case "{":
                return this.#object(start);
            case "/":
            case "/=": {
                const regex = this.scanner.regex(this.token);
                this.replace(regex);
                this.next();
                return this.finish("RegExpLiteral", start, {
                    raw: regex.value,
                });
            }
            case "<":
                if (!this.options.jsx) return this.unexpected();
                return this.#jsxExpression();
            case "@": {
                const decorators = this.parseDecorators();
                return this.parseClass(start, decorators, true, false, false);
            }
            default:
                return this.unexpected();
        }
    }

    #word(start: number, value: string): Node {
        switch (value) {
            case "function":
                return this.parseFunction(start, false, true);
            case "class":
                return this.parseClass(start, [], true, false, false);
            case "this":
                this.next();
                return this.finish("ThisExpression", start, {});
            case "super":
                this.next();
                return this.finish("Super", start, {});
            case "null":
                this.next();
                return this.finish("NullLiteral", start, {});
            case "true":
            case "false":
                this.next();
                return this.finish("BooleanLiteral", start, {
                    value: value === "true",
                });
            case "async": {
                const next = this.peek();
                if (this.is("function", next) && !next.newline) {
                    this.next();
                    return this.parseFunction(start, true, true);
                }
                break;
            }
            case "import":
                return this.#import(start);
        }
        return this.parseIdentifier();
    }

    #import(start: number): Node {
        const next = this.peek();
        if (this.is(".", next)) {
            this.next();
            this.next();
            const property = this.parseIdentifier().name;
            if (this.is("(")) {
                this.next();
                return this.#importCall(start, property);
            }
            return this.finish("MetaProperty", start, {
                meta: "import",
                property,
            });
        }
        this.next();
        this.expect("(");
        return this.#importCall(start, null);
    }

    #importCall(start: number, phase: string | null): Node {
        const source = this.withIn(true, () => this.parseAssignment());
        const options =
            this.eat(",") && !this.is(")") ? this.parseAssignment() : null;
        this.eat(",");
        this.expect(")");
        return this.finish("ImportExpression", start, {
            source,
            options,
            phase,
        });
    }

    #template(): Node & { type: "TemplateLiteral" } {
        const start = this.token.start;
        const { quasis, parts } = this.parseTemplateParts(() =>
            this.withIn(true, () => this.parseExpression()),
        );
        return this.finish("TemplateLiteral", start, {
            quasis,
            expressions: parts,
        });
    }

    #array(start: number): Node {
        this.expect("[");
        const elements: (Node | null)[] = [];
        while (!this.is("]")) {
            if (this.is(",")) {
                this.next();
                elements.push(null);
                continue;
            }
            const elementStart = this.token.start;
            if (this.eat("..."))
                elements.push(
                    this.finish("SpreadElement", elementStart, {
                        argument: this.withIn(true, () =>
                            this.parseAssignment(),
                        ),
                    }),
                );
            else elements.push(this.withIn(true, () => this.parseAssignment()));
            if (!this.eat(",")) break;
        }
        this.expect("]");
        return this.finish("ArrayExpression", start, { elements });
    }

    #object(start: number): Node {
        this.expect("{");
        const properties: Node[] = [];
        while (!this.is("}")) {
            properties.push(this.withIn(true, () => this.#property()));
            if (!this.eat(",")) break;
        }
        this.expect("}");
        return this.finish("ObjectExpression", start, { properties });
    }

    #property(): Node {
        const start = this.token.start;
        if (this.eat("..."))
            return this.finish("SpreadElement", start, {
                argument: this.parseAssignment(),
            });

        let async = false;
        let generator = false;
        let kind: "get" | "init" | "set" = "init";

        if (this.is("async") && this.#modifies()) {
            this.next();
            async = true;
        }
        if (this.eat("*")) generator = true;
        if ((this.is("get") || this.is("set")) && this.#modifies())
            kind = this.next().value as "get" | "set";

        const { key, computed } = this.parsePropertyKey();

        if (this.is("(") || this.is("<")) {
            const value = this.#method(this.token.start, async, generator);
            return this.finish("Property", start, {
                key,
                value,
                kind,
                method: kind === "init",
                shorthand: false,
                computed,
            });
        }

        if (this.eat(":"))
            return this.finish("Property", start, {
                key,
                value: this.parseAssignment(),
                kind,
                method: false,
                shorthand: false,
                computed,
            });

        let value: Node = key;
        if (this.is("=")) {
            this.next();
            value = this.finish("AssignmentPattern", start, {
                left: key,
                right: this.parseAssignment(),
            });
        }
        return this.finish("Property", start, {
            key,
            value,
            kind,
            method: false,
            shorthand: true,
            computed,
        });
    }

    /** Whether a modifier word (async, get, set, static...) applies to a following name. */
    #modifies(): boolean {
        const next = this.peek();
        return (
            !next.newline &&
            !["(", ")", ":", ",", "}", "=", ";", "?", "!", "<", "."].includes(
                next.value,
            ) &&
            next.type !== "eof"
        );
    }

    parsePropertyKey(): { key: Node; computed: boolean } {
        const { start, type, value } = this.token;

        if (this.is("[")) {
            this.next();
            const key = this.withIn(true, () => this.parseAssignment());
            this.expect("]");
            return { key, computed: true };
        }

        this.next();
        switch (type) {
            case "string":
                return {
                    key: this.finish("StringLiteral", start, { raw: value }),
                    computed: false,
                };
            case "number":
                return {
                    key: this.finish("NumericLiteral", start, { raw: value }),
                    computed: false,
                };
            case "private":
                return {
                    key: this.finish("PrivateName", start, {
                        name: value.slice(1),
                    }),
                    computed: false,
                };
            case "name":
                return {
                    key: this.finish("Identifier", start, { name: value }),
                    computed: false,
                };
            default:
                return this.raise("Expected a property name", start);
        }
    }

    #method(
        start: number,
        async: boolean,
        generator: boolean,
    ): FunctionExpression {
        const typeParameters = this.parseTypeParameters();
        const params = this.parseParameters();
        const returnType = this.eat(":") ? this.parseReturnType() : null;
        const body = this.is("{") ? this.parseBlock() : null;
        return this.finish("FunctionExpression", start, {
            id: null,
            params,
            body,
            async,
            generator,
            typeParameters,
            returnType,
        });
    }

    parseFunction(start: number, async: boolean, expression: boolean): Node {
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

        if (expression) {
            const body =
                this.is("{") || !this.options.typescript
                    ? this.parseBlock()
                    : null;
            return this.finish("FunctionExpression", start, { ...parts, body });
        }
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

    parseParameters(): Node[] {
        this.expect("(");
        const params: Node[] = [];
        while (!this.is(")")) {
            params.push(this.#parameter());
            if (!this.eat(",")) break;
        }
        this.expect(")");
        return params;
    }

    #parameter(): Node {
        const start = this.token.start;
        const decorators = this.parseDecorators();
        const modifiers: {
            accessibility?: "private" | "protected" | "public";
            readonly?: boolean;
            override?: boolean;
        } = {};

        while (
            ["public", "private", "protected", "readonly", "override"].includes(
                this.token.value,
            ) &&
            this.#modifies()
        ) {
            const { value } = this.next();
            if (value === "readonly") modifiers.readonly = true;
            else if (value === "override") modifiers.override = true;
            else
                modifiers.accessibility = value as
                    | "private"
                    | "protected"
                    | "public";
        }

        const parameter = this.parseBindingElement();
        if (Object.keys(modifiers).length === 0 && decorators.length === 0)
            return parameter;
        return this.finish("TSParameterProperty", start, {
            ...modifiers,
            decorators,
            parameter,
        });
    }

    /** Parses a binding target with optional `?`, type annotation and default. */
    parseBindingElement(): Node {
        const start = this.token.start;
        if (this.eat("...")) {
            const argument = this.parseBindingTarget();
            const optional = this.eat("?");
            const typeAnnotation = this.parseTypeAnnotation();
            return this.finish("RestElement", start, {
                argument,
                typeAnnotation,
                optional,
            });
        }

        const target = this.parseBindingTarget();
        if (this.eat("?")) target.optional = true;
        if (this.is(":")) {
            const typeAnnotation = this.parseTypeAnnotation();
            target.typeAnnotation = typeAnnotation;
            target.end = this.previous;
        }
        if (!this.eat("=")) return target;
        return this.finish("AssignmentPattern", start, {
            left: target,
            right: this.withIn(true, () => this.parseAssignment()),
        });
    }

    parseBindingTarget(): Node & {
        optional?: boolean;
        typeAnnotation?: Node | null;
    } {
        const start = this.token.start;

        if (this.eat("[")) {
            const elements: (Node | null)[] = [];
            while (!this.is("]")) {
                if (this.eat(",")) {
                    elements.push(null);
                    continue;
                }
                elements.push(this.parseBindingElement());
                if (!this.eat(",")) break;
            }
            this.expect("]");
            return this.finish("ArrayPattern", start, {
                elements,
                typeAnnotation: null,
            });
        }

        if (this.eat("{")) {
            const properties: Node[] = [];
            while (!this.is("}")) {
                const propertyStart = this.token.start;
                if (this.eat("...")) {
                    properties.push(
                        this.finish("RestElement", propertyStart, {
                            argument: this.parseBindingTarget(),
                            typeAnnotation: null,
                        }),
                    );
                } else {
                    const { key, computed } = this.parsePropertyKey();
                    if (this.eat(":")) {
                        const value = this.parseBindingElement();
                        properties.push(
                            this.finish("Property", propertyStart, {
                                key,
                                value,
                                kind: "init",
                                method: false,
                                shorthand: false,
                                computed,
                            }),
                        );
                    } else {
                        const value = this.eat("=")
                            ? this.finish("AssignmentPattern", propertyStart, {
                                  left: key,
                                  right: this.withIn(true, () =>
                                      this.parseAssignment(),
                                  ),
                              })
                            : key;
                        properties.push(
                            this.finish("Property", propertyStart, {
                                key,
                                value,
                                kind: "init",
                                method: false,
                                shorthand: true,
                                computed,
                            }),
                        );
                    }
                }
                if (!this.eat(",")) break;
            }
            this.expect("}");
            return this.finish("ObjectPattern", start, {
                properties,
                typeAnnotation: null,
            });
        }

        if (this.is("this")) {
            this.next();
            return this.finish("Identifier", start, { name: "this" });
        }
        return this.parseIdentifier();
    }

    parseDecorators(): Decorator[] {
        const decorators: Decorator[] = [];
        while (this.is("@")) {
            const start = this.next().start;
            let expression: Node;
            if (this.is("(")) {
                this.next();
                expression = this.parseExpression();
                this.expect(")");
                expression.parenthesized = true;
            } else {
                const nameStart = this.token.start;
                expression = this.parseIdentifier();
                while (this.eat("."))
                    expression = this.finish("MemberExpression", nameStart, {
                        object: expression,
                        property: this.#memberName(),
                        computed: false,
                        optional: false,
                    });
                let typeArguments: TypeArguments | null = null;
                if (this.options.typescript && this.is("<"))
                    typeArguments = this.parseTypeArguments();
                if (this.is("("))
                    expression = this.#call(
                        nameStart,
                        expression,
                        typeArguments,
                        false,
                    );
            }
            decorators.push(this.finish("Decorator", start, { expression }));
        }
        return decorators;
    }

    parseClass(
        start: number,
        decorators: Decorator[],
        expression: boolean,
        abstract: boolean,
        declare: boolean,
    ): Node {
        this.expect("class");
        const id =
            this.isName() &&
            !["extends", "implements"].includes(this.token.value)
                ? this.parseIdentifier()
                : null;
        const typeParameters = this.parseTypeParameters();
        let superClass: Node | null = null;
        let superTypeArguments: TypeArguments | null = null;

        if (this.eat("extends")) {
            superClass = this.parseLeftHandSide();
            if (superClass.type === "TSInstantiationExpression") {
                superTypeArguments = superClass.typeArguments;
                superClass = superClass.expression;
            }
        }

        const implemented: Node[] = [];
        if (this.eat("implements")) {
            do implemented.push(this.parseType());
            while (this.eat(","));
        }

        const body = this.#classBody();
        const parts = {
            id,
            superClass,
            superTypeArguments,
            implements: implemented,
            body,
            decorators,
            typeParameters,
            abstract,
            declare,
        };
        return expression
            ? this.finish("ClassExpression", start, parts)
            : this.finish("ClassDeclaration", start, parts);
    }

    #classBody(): ClassBody {
        const start = this.expect("{").start;
        const body: Node[] = [];
        while (!this.is("}")) {
            if (this.eat(";")) continue;
            body.push(this.#member());
        }
        this.expect("}");
        return this.finish("ClassBody", start, { body });
    }

    #member(): Node {
        const start = this.token.start;
        const decorators = this.parseDecorators();
        const modifiers: Record<string, boolean | string> = {};

        while (
            ExpressionParser.#modifiers.has(this.token.value) &&
            this.isName() &&
            (this.#modifies() ||
                (this.is("static") && this.is("{", this.peek())))
        ) {
            if (this.is("static") && this.is("{", this.peek())) break;
            const { value } = this.next();
            if (["private", "protected", "public"].includes(value))
                modifiers.accessibility = value;
            else modifiers[value] = true;
        }

        if (this.is("static") && this.is("{", this.peek())) {
            this.next();
            const block = this.parseBlock();
            return this.finish("StaticBlock", start, { body: block.body });
        }

        const flags = {
            static: modifiers.static === true,
            ...(typeof modifiers.accessibility === "string"
                ? {
                      accessibility: modifiers.accessibility as
                          | "private"
                          | "protected"
                          | "public",
                  }
                : {}),
            abstract: modifiers.abstract === true,
            declare: modifiers.declare === true,
            override: modifiers.override === true,
            readonly: modifiers.readonly === true,
        };

        if (this.is("[")) {
            const index = this.parseIndexSignature(
                start,
                flags.readonly,
                flags.static,
            );
            if (index) {
                this.eat(";") || this.eat(",");
                return index;
            }
        }

        const generator = this.eat("*");
        let kind: "constructor" | "get" | "method" | "set" = "method";
        if ((this.is("get") || this.is("set")) && this.#modifies())
            kind = this.next().value as "get" | "set";

        const { key, computed } = this.parsePropertyKey();
        if (
            !computed &&
            key.type === "Identifier" &&
            key.name === "constructor" &&
            (this.is("(") || this.is("<"))
        )
            kind = "constructor";
        if (
            !computed &&
            key.type === "StringLiteral" &&
            key.raw.slice(1, -1) === "constructor"
        )
            kind = "constructor";

        const optional = this.eat("?");

        if (this.is("(") || this.is("<")) {
            const value = this.#method(
                this.token.start,
                modifiers.async === true,
                generator,
            );
            if (!value.body) this.semicolon();
            return this.finish("MethodDefinition", start, {
                ...flags,
                key,
                value,
                kind,
                computed,
                optional,
                decorators,
            });
        }

        const definite = this.eat("!");
        const typeAnnotation = this.parseTypeAnnotation();
        const value = this.eat("=")
            ? this.withIn(true, () => this.parseAssignment())
            : null;
        this.semicolon();
        return this.finish("PropertyDefinition", start, {
            ...flags,
            key,
            value,
            computed,
            optional,
            definite,
            accessor: modifiers.accessor === true,
            typeAnnotation,
            decorators,
        });
    }

    // JSX

    #jsxExpression(): Node {
        const element = this.#jsxElement();
        this.rescan(element.end);
        this.previous = element.end;
        return element;
    }

    /** Parses an element from `<`; leaves the scanner right after its last `>`. */
    #jsxElement(): JSXElement {
        const start = this.expect("<").start;

        if (this.is(">")) return this.#jsxChildren(start, null, [], null);

        const name = this.#jsxName();
        const typeArguments =
            this.options.typescript && this.is("<")
                ? this.parseTypeArguments()
                : null;
        const attributes: Node[] = [];

        while (!this.is("/") && !this.is(">")) {
            const attributeStart = this.token.start;
            if (this.is("{")) {
                this.next();
                this.expect("...");
                const argument = this.parseAssignment();
                this.expect("}");
                attributes.push(
                    this.finish("JSXSpreadAttribute", attributeStart, {
                        argument,
                    }),
                );
                continue;
            }
            const attributeName = this.#jsxName();
            let value: Node | null = null;
            if (this.eat("=")) value = this.#jsxValue();
            attributes.push(
                this.finish("JSXAttribute", attributeStart, {
                    name: attributeName,
                    value,
                }),
            );
        }

        if (this.is("/")) {
            this.next();
            if (!this.is(">")) this.unexpected();
            this.previous = this.token.end;
            return this.finish("JSXElement", start, {
                name,
                attributes,
                children: [],
                selfClosing: true,
                typeArguments,
            });
        }

        return this.#jsxChildren(start, name, attributes, typeArguments);
    }

    #jsxName(): string {
        if (!this.isName()) this.unexpected("Expected a JSX name");
        this.replace(this.scanner.jsxName(this.token));
        let name = this.next().value;
        while ((this.is(".") || this.is(":")) && this.isName(this.peek())) {
            name += this.next().value;
            this.replace(this.scanner.jsxName(this.token));
            name += this.next().value;
        }
        return name;
    }

    #jsxValue(): Node {
        const start = this.token.start;
        if (
            this.token.type === "string" ||
            (this.token.type === "invalid" &&
                /["']/.test(this.source[start] ?? ""))
        ) {
            const token = this.scanner.jsxString(this.token);
            this.replace(token);
            this.next();
            return this.finish("StringLiteral", start, { raw: token.value });
        }
        if (this.is("<")) {
            const element = this.#jsxElement();
            this.rescan(element.end);
            return element;
        }
        this.expect("{");
        const expression = this.is("}") ? null : this.parseAssignment();
        this.expect("}");
        return this.finish("JSXExpressionContainer", start, { expression });
    }

    /** Parses children after the opening `>` up to and including the closing tag. */
    #jsxChildren(
        start: number,
        name: string | null,
        attributes: Node[],
        typeArguments: TypeArguments | null,
    ): JSXElement {
        if (!this.is(">")) this.unexpected();
        let position = this.token.end;
        const children: Node[] = [];

        for (;;) {
            const char = this.source[position];
            if (char === undefined)
                this.raise("Unterminated JSX element", start);

            if (char !== "{" && char !== "<") {
                const text = this.scanner.jsxText(position);
                children.push({
                    type: "JSXText",
                    start: text.start,
                    end: text.end,
                    raw: text.value,
                });
                position = text.end;
                continue;
            }

            this.rescan(position);

            if (char === "{") {
                const childStart = this.next().start;
                let child: Node;
                if (this.is("}"))
                    child = this.finish("JSXExpressionContainer", childStart, {
                        expression: null,
                    });
                else if (this.eat("...")) {
                    const expression = this.parseExpression();
                    child = this.finish("JSXSpreadChild", childStart, {
                        expression,
                    });
                } else {
                    const expression = this.parseExpression();
                    child = this.finish("JSXExpressionContainer", childStart, {
                        expression,
                    });
                }
                if (!this.is("}")) this.unexpected();
                child.end = this.token.end;
                children.push(child);
                position = this.token.end;
                continue;
            }

            if (this.is("/", this.peek())) {
                this.next();
                this.next();
                const closing = this.is(">") ? null : this.#jsxName();
                if (closing !== name)
                    this.raise(
                        `Expected closing tag for ${name ?? "fragment"}`,
                        this.token.start,
                    );
                if (!this.is(">")) this.unexpected();
                this.previous = this.token.end;
                return this.finish("JSXElement", start, {
                    name,
                    attributes,
                    children,
                    selfClosing: false,
                    typeArguments,
                });
            }

            const child = this.#jsxElement();
            children.push(child);
            position = child.end;
        }
    }
}
