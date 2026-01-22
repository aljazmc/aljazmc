import type {
    Identifier,
    Node,
    TemplateElement,
    TypeArguments,
    TypeParameters,
} from "../ast.js";
import BaseParser from "./base.js";

/** Parses TypeScript types, and the literals and names they share with expressions. */
export default abstract class TypeParser extends BaseParser {
    static readonly #keywords = new Set([
        "any",
        "bigint",
        "boolean",
        "intrinsic",
        "never",
        "null",
        "number",
        "object",
        "string",
        "symbol",
        "undefined",
        "unknown",
        "void",
    ]);

    /** Whether a conditional type may start here (not in its extends clause). */
    #conditional = true;

    abstract parseParameters(): Node[];
    abstract parsePropertyKey(): { key: Node; computed: boolean };

    parseIdentifier(): Identifier {
        if (!this.isName()) this.unexpected("Expected an identifier");
        const { start, value } = this.next();
        return this.finish("Identifier", start, { name: value });
    }

    parseString(): Node & { type: "StringLiteral" } {
        if (this.token.type !== "string") this.unexpected("Expected a string");
        const { start, value } = this.next();
        return this.finish("StringLiteral", start, { raw: value });
    }

    /** Parses a template, with parts parsed by the given parser. */
    protected parseTemplateParts(part: () => Node): {
        quasis: TemplateElement[];
        parts: Node[];
    } {
        const quasis: TemplateElement[] = [];
        const parts: Node[] = [];

        for (;;) {
            const token = this.token;
            if (token.type !== "template")
                this.unexpected("Expected a template");
            const tail =
                token.value.endsWith("`") &&
                (token.value.length > 1 || quasis.length > 0);
            const raw = token.value.slice(1, tail ? -1 : -2);
            quasis.push({
                type: "TemplateElement",
                start: token.start,
                end: token.end,
                raw,
                tail,
            });
            this.next();
            if (tail) return { quasis, parts };

            parts.push(part());
            if (!this.is("}")) this.unexpected('Expected "}" in template');
            this.replace(
                this.scanner.template(this.token.start, this.token.newline),
            );
        }
    }

    parseTypeAnnotation(): Node | null {
        if (!this.eat(":")) return null;
        return this.parseType();
    }

    parseType(): Node {
        const start = this.token.start;

        if (this.is("<")) return this.#functionType(start, false);
        if (
            this.is("new") ||
            (this.is("abstract") && this.is("new", this.peek()))
        )
            return this.#functionType(start, true);
        if (this.is("(")) {
            const fn = this.attempt(() => this.#functionType(start, false));
            if (fn) return fn;
        }

        const check = this.#union();
        if (!this.#conditional || this.token.newline || !this.is("extends"))
            return check;

        this.next();
        this.#conditional = false;
        const extendsType = this.parseType();
        this.#conditional = true;
        this.expect("?");
        const trueType = this.parseType();
        this.expect(":");
        const falseType = this.parseType();
        return this.finish("TSConditionalType", start, {
            checkType: check,
            extendsType,
            trueType,
            falseType,
        });
    }

    parseReturnType(): Node {
        const start = this.token.start;
        const asserts =
            this.is("asserts") &&
            (this.isName(this.peek()) || this.is("this", this.peek())) &&
            !this.peek().newline;
        if (asserts) this.next();

        if (
            (this.isName() || this.is("this")) &&
            (asserts || this.is("is", this.peek()))
        ) {
            const parameter = this.is("this")
                ? this.#thisType()
                : this.parseIdentifier();
            let typeAnnotation: Node | null = null;
            if (!this.token.newline && this.eat("is"))
                typeAnnotation = this.parseType();
            if (asserts || typeAnnotation)
                return this.finish("TSTypePredicate", start, {
                    parameterName: parameter,
                    typeAnnotation,
                    asserts,
                });
            return parameter;
        }

        return this.parseType();
    }

    parseTypeParameters(): TypeParameters | null {
        if (!this.is("<")) return null;
        const start = this.next().start;
        const params: TypeParameters["params"] = [];

        while (!this.is(">")) {
            const paramStart = this.token.start;
            const modifiers = { in: false, out: false, const: false };
            while (
                ["in", "out", "const"].includes(this.token.value) &&
                this.isName(this.peek())
            ) {
                modifiers[this.token.value as keyof typeof modifiers] = true;
                this.next();
            }
            const { value: name } = this.next();
            const constraint = this.eat("extends") ? this.parseType() : null;
            const fallback = this.eat("=") ? this.parseType() : null;
            params.push(
                this.finish("TSTypeParameter", paramStart, {
                    name,
                    constraint,
                    default: fallback,
                    ...modifiers,
                }),
            );
            if (!this.eat(",")) break;
        }

        this.expect(">");
        return this.finish("TSTypeParameterDeclaration", start, { params });
    }

    parseTypeArguments(): TypeArguments {
        const start = this.expect("<").start;
        const params: Node[] = [];
        while (!this.is(">")) {
            params.push(this.parseType());
            if (!this.eat(",")) break;
        }
        this.expect(">");
        return this.finish("TSTypeParameterInstantiation", start, { params });
    }

    parseEntityName(): Node {
        const start = this.token.start;
        let name: Node = this.parseIdentifier();
        while (this.is(".") && this.isName(this.peek())) {
            this.next();
            name = this.finish("TSQualifiedName", start, {
                left: name,
                right: this.parseIdentifier(),
            });
        }
        return name;
    }

    /** Parses `{ ... }` members of an interface or a type literal. */
    parseTypeMembers(): Node[] {
        this.expect("{");
        const members: Node[] = [];
        while (!this.is("}")) {
            members.push(this.#member());
            if (
                !this.eat(";") &&
                !this.eat(",") &&
                !this.is("}") &&
                !this.token.newline
            )
                this.unexpected();
        }
        this.expect("}");
        return members;
    }

    #functionType(start: number, construct: boolean): Node {
        const abstract = construct && this.eat("abstract");
        if (construct) this.expect("new");
        const typeParameters = this.parseTypeParameters();
        const params = this.parseParameters();
        this.expect("=>");
        const returnType = this.parseReturnType();
        return construct
            ? this.finish("TSConstructorType", start, {
                  typeParameters,
                  params,
                  returnType,
                  abstract,
              })
            : this.finish("TSFunctionType", start, {
                  typeParameters,
                  params,
                  returnType,
              });
    }

    #union(): Node {
        return this.#list("|", "TSUnionType", () =>
            this.#list("&", "TSIntersectionType", () => this.#operator()),
        );
    }

    #list(
        operator: string,
        type: "TSIntersectionType" | "TSUnionType",
        parse: () => Node,
    ): Node {
        const start = this.token.start;
        const leading = this.eat(operator);
        const types = [parse()];
        while (this.eat(operator)) types.push(parse());
        if (types.length === 1 && !leading) return types[0] as Node;
        return this.finish(type, start, { types });
    }

    #operator(): Node {
        const start = this.token.start;

        if (
            ["keyof", "unique", "readonly"].includes(this.token.value) &&
            this.isName() &&
            !this.#ends(this.peek())
        ) {
            const operator = this.next().value;
            return this.finish("TSTypeOperator", start, {
                operator,
                typeAnnotation: this.#operator(),
            });
        }

        if (this.is("infer") && this.isName(this.peek())) {
            this.next();
            const name = this.next().value;
            const constraint = this.is("extends")
                ? (this.attempt(() => {
                      this.next();
                      const conditional = this.#conditional;
                      this.#conditional = false;
                      const type = this.parseType();
                      this.#conditional = conditional;
                      if (conditional && this.is("?")) this.unexpected();
                      return type;
                  }) ?? null)
                : null;
            return this.finish("TSInferType", start, { name, constraint });
        }

        let type = this.#primary();
        while (!this.token.newline && this.is("[")) {
            this.next();
            if (this.eat("]"))
                type = this.finish("TSArrayType", start, { elementType: type });
            else {
                const indexType = this.parseType();
                this.expect("]");
                type = this.finish("TSIndexedAccessType", start, {
                    objectType: type,
                    indexType,
                });
            }
        }
        return type;
    }

    /** Whether the token ends a type, so a preceding keyword is a plain name. */
    #ends(token: typeof this.token): boolean {
        return (
            [")", "]", ",", ";", ">", "=", "|", "&", "}", "?", ":"].includes(
                token.value,
            ) || token.type === "eof"
        );
    }

    /** Parses a primary type; brackets inside allow conditional types again. */
    #primary(): Node {
        const conditional = this.#conditional;
        this.#conditional = true;
        try {
            return this.#primaryType();
        } finally {
            this.#conditional = conditional;
        }
    }

    #primaryType(): Node {
        const { start, type, value } = this.token;

        if (type === "string" || type === "number")
            return this.#literal(start, () => this.next());
        if (type === "template") {
            const { quasis, parts } = this.parseTemplateParts(() =>
                this.parseType(),
            );
            return this.finish("TSTemplateLiteralType", start, {
                quasis,
                types: parts,
            });
        }
        if (this.is("-") && this.peek().type === "number")
            return this.#literal(start, () => this.next());

        switch (value) {
            case "(": {
                this.next();
                const inner = this.parseType();
                this.expect(")");
                inner.parenthesized = true;
                return inner;
            }
            case "[":
                return this.#tuple(start);
            case "{":
                return (
                    this.#mapped(start) ??
                    this.finish("TSTypeLiteral", start, {
                        members: this.parseTypeMembers(),
                    })
                );
        }

        if (!this.isName()) this.unexpected("Expected a type");

        if ((value === "true" || value === "false") && this.isName())
            return this.#literal(start, () => this.next());
        if (value === "this") return this.#thisType();
        if (value === "typeof") {
            this.next();
            const exprName = this.is("import")
                ? this.#importType(this.token.start)
                : this.parseEntityName();
            const typeArguments =
                !this.token.newline && this.is("<")
                    ? this.parseTypeArguments()
                    : null;
            return this.finish("TSTypeQuery", start, {
                exprName,
                typeArguments,
            });
        }
        if (value === "import") return this.#importType(start);
        if (TypeParser.#keywords.has(value) && !this.is(".", this.peek())) {
            this.next();
            return this.finish("TSKeyword", start, { name: value });
        }

        const typeName = this.parseEntityName();
        const typeArguments =
            !this.token.newline && this.is("<")
                ? this.parseTypeArguments()
                : null;
        return this.finish("TSTypeReference", start, {
            typeName,
            typeArguments,
        });
    }

    #literal(start: number, consume: () => void): Node {
        const negative = this.is("-");
        if (negative) this.next();
        const token = this.token;
        consume();
        let literal: Node =
            token.type === "string"
                ? this.finish("StringLiteral", token.start, {
                      raw: token.value,
                  })
                : token.type === "number"
                  ? this.finish("NumericLiteral", token.start, {
                        raw: token.value,
                    })
                  : this.finish("BooleanLiteral", token.start, {
                        value: token.value === "true",
                    });
        if (negative)
            literal = this.finish("UnaryExpression", start, {
                operator: "-",
                argument: literal,
            });
        return this.finish("TSLiteralType", start, { literal });
    }

    #thisType(): Node {
        const { start } = this.expect("this");
        return this.finish("TSThisType", start, {});
    }

    #importType(start: number): Node {
        this.expect("import");
        this.expect("(");
        const argument = this.parseType();
        const options =
            this.eat(",") && !this.is(")") ? this.parseAssignment() : null;
        this.eat(",");
        this.expect(")");
        let qualifier: Node | null = null;
        if (this.eat(".")) qualifier = this.parseEntityName();
        const typeArguments = this.is("<") ? this.parseTypeArguments() : null;
        return this.finish("TSImportType", start, {
            argument,
            options,
            qualifier,
            typeArguments,
        });
    }

    #tuple(start: number): Node {
        this.expect("[");
        const elementTypes: Node[] = [];

        while (!this.is("]")) {
            const elementStart = this.token.start;
            const rest = this.eat("...");
            let element: Node;

            if (
                this.isName() &&
                (this.is(":", this.peek()) ||
                    (this.is("?", this.peek()) && this.#labelled()))
            ) {
                const label = this.parseIdentifier();
                const optional = this.eat("?");
                this.expect(":");
                element = this.finish("TSNamedTupleMember", elementStart, {
                    label,
                    elementType: this.parseType(),
                    optional,
                });
            } else {
                element = this.parseType();
                if (this.eat("?"))
                    element = this.finish("TSOptionalType", elementStart, {
                        typeAnnotation: element,
                    });
            }

            if (rest)
                element = this.finish("TSRestType", elementStart, {
                    typeAnnotation: element,
                });
            elementTypes.push(element);
            if (!this.eat(",")) break;
        }

        this.expect("]");
        return this.finish("TSTupleType", start, { elementTypes });
    }

    /** Whether `name ?` starts a labelled tuple member `name?: T`. */
    #labelled(): boolean {
        const snapshot = this.snapshot();
        this.next();
        this.next();
        const labelled = this.is(":");
        this.restore(snapshot);
        return labelled;
    }

    #mapped(start: number): Node | undefined {
        return this.attempt(() => {
            this.expect("{");
            let readonly: string | null = null;
            if (this.is("+") || this.is("-")) readonly = this.next().value;
            if (this.is("readonly")) {
                this.next();
                readonly = readonly ? readonly : "true";
            } else if (readonly) this.unexpected();
            this.expect("[");
            const { value: key } = this.next();
            this.expect("in");
            const constraint = this.parseType();
            const nameType = this.eat("as") ? this.parseType() : null;
            this.expect("]");
            let optional: string | null = null;
            if (this.is("+") || this.is("-")) {
                optional = this.next().value;
                this.expect("?");
            } else if (this.eat("?")) optional = "true";
            const typeAnnotation = this.parseTypeAnnotation();
            this.eat(";") || this.eat(",");
            this.expect("}");
            return this.finish("TSMappedType", start, {
                key,
                constraint,
                nameType,
                typeAnnotation,
                optional,
                readonly,
            });
        });
    }

    #member(): Node {
        const start = this.token.start;

        if (this.is("(") || this.is("<"))
            return this.#signature(start, "TSCallSignatureDeclaration");
        if (
            this.is("new") &&
            (this.is("(", this.peek()) || this.is("<", this.peek()))
        ) {
            this.next();
            return this.#signature(start, "TSConstructSignatureDeclaration");
        }

        const readonly = this.is("readonly") && this.#modifies();
        if (readonly) this.next();

        if (this.is("[")) {
            const index = this.attempt(() =>
                this.#index(start, readonly, false),
            );
            if (index) return index;
        }

        let kind: "get" | "method" | "set" = "method";
        if ((this.is("get") || this.is("set")) && this.#modifies())
            kind = this.next().value as "get" | "set";

        const { key, computed } = this.parsePropertyKey();
        const optional = this.eat("?");

        if (this.is("(") || this.is("<")) {
            const typeParameters = this.parseTypeParameters();
            const params = this.parseParameters();
            const returnType = this.eat(":") ? this.parseReturnType() : null;
            return this.finish("TSMethodSignature", start, {
                key,
                computed,
                optional,
                kind,
                typeParameters,
                params,
                returnType,
            });
        }

        const typeAnnotation = this.parseTypeAnnotation();
        return this.finish("TSPropertySignature", start, {
            key,
            computed,
            optional,
            readonly,
            typeAnnotation,
        });
    }

    /** Whether the current word modifies a following member name. */
    #modifies(): boolean {
        const next = this.peek();
        return (
            !next.newline &&
            !["(", ")", ":", "?", ";", ",", "}", "=", "<", "!"].includes(
                next.value,
            )
        );
    }

    #signature(
        start: number,
        type: "TSCallSignatureDeclaration" | "TSConstructSignatureDeclaration",
    ): Node {
        const typeParameters = this.parseTypeParameters();
        const params = this.parseParameters();
        const returnType = this.eat(":") ? this.parseReturnType() : null;
        return this.finish(type, start, { typeParameters, params, returnType });
    }

    /** Parses `[key: T]: U` after optional modifiers. */
    protected parseIndexSignature(
        start: number,
        readonly: boolean,
        isStatic: boolean,
    ): Node | undefined {
        return this.attempt(() => this.#index(start, readonly, isStatic));
    }

    #index(start: number, readonly: boolean, isStatic: boolean): Node {
        this.expect("[");
        const parameters: Node[] = [];
        do {
            const paramStart = this.token.start;
            const { value: name } = this.next();
            this.expect(":");
            const typeAnnotation = this.parseType();
            parameters.push(
                this.finish("Identifier", paramStart, { name, typeAnnotation }),
            );
        } while (this.eat(","));
        this.expect("]");
        const typeAnnotation = this.parseTypeAnnotation();
        return this.finish("TSIndexSignature", start, {
            parameters,
            typeAnnotation,
            readonly,
            static: isStatic,
        });
    }
}
