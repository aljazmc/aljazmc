import type { Node, NodeOf } from "@aljazmc/syntax";
import {
    align,
    type Doc,
    group,
    hardline,
    ifBreak,
    indent,
    indentIfBreak,
    join,
    line,
    lineSuffixBoundary,
    softline,
} from "../doc.js";
import Assignments from "./assignments.js";
import Expressions from "./expressions.js";
import Functions from "./functions.js";
import Nodes from "./nodes.js";
import Section from "./section.js";
import Statements from "./statements.js";

/** TypeScript declarations and types. */
export default class TypeScript extends Section {
    override register(): void {
        const p = this.printer;
        const expressions = () => p.section(Expressions);

        p.handle(["TSInterfaceDeclaration"], (node) => this.#interface(node));
        p.handle(["TSInterfaceBody", "TSTypeLiteral"], (node) =>
            expressions().object(node),
        );
        p.handle(["TSTypeAliasDeclaration"], (node) => [
            p
                .section(Assignments)
                .printAssignment(
                    node,
                    [
                        node.declare ? "declare " : "",
                        "type ",
                        this.print(node.id),
                        this.print(node.typeParameters),
                    ],
                    " =",
                    node.typeAnnotation,
                ),
            p.semi,
        ]);
        p.handle(["TSEnumDeclaration"], (node) => this.#enum(node));
        p.handle(["TSEnumMember"], (node) => [
            node.id.type === "StringLiteral"
                ? expressions().propertyKey({ key: node.id, computed: false })
                : this.print(node.id),
            node.initializer ? [" = ", this.print(node.initializer)] : "",
        ]);
        p.handle(["TSModuleDeclaration"], (node) => this.#module(node));
        p.handle(["TSExportAssignment"], (node) => [
            "export = ",
            this.print(node.expression),
            p.semi,
        ]);
        p.handle(["TSNamespaceExportDeclaration"], (node) => [
            "export as namespace ",
            this.print(node.id),
            p.semi,
        ]);
        p.handle(["TSImportEqualsDeclaration"], (node) => [
            node.isExport ? "export " : "",
            "import ",
            node.importKind === "type" ? "type " : "",
            this.print(node.id),
            " = ",
            this.print(node.moduleReference),
            p.semi,
        ]);
        p.handle(["TSExternalModuleReference"], (node) => [
            "require(",
            this.print(node.expression),
            ")",
        ]);

        p.handle(
            ["TSTypeParameterDeclaration", "TSTypeParameterInstantiation"],
            (node) => this.#typeParameters(node),
        );
        p.handle(["TSTypeParameter"], (node) => this.#typeParameter(node));

        p.handle(["TSKeyword"], (node) => node.name);
        p.handle(["TSThisType"], () => "this");
        p.handle(["TSTypeReference"], (node) => [
            this.print(node.typeName),
            this.print(node.typeArguments),
        ]);
        p.handle(["TSQualifiedName"], (node) => [
            this.print(node.left),
            ".",
            this.print(node.right),
        ]);
        p.handle(["TSLiteralType"], (node) => this.print(node.literal));
        p.handle(["TSTemplateLiteralType"], (node) =>
            expressions().template(node.quasis, node.types),
        );
        p.handle(["TSArrayType"], (node) => [
            this.print(node.elementType),
            "[]",
        ]);
        p.handle(["TSIndexedAccessType"], (node) => [
            this.print(node.objectType),
            "[",
            this.print(node.indexType),
            "]",
        ]);
        p.handle(["TSTypeOperator"], (node) => [
            node.operator,
            " ",
            this.print(node.typeAnnotation),
        ]);
        p.handle(["TSInferType"], (node) => [
            "infer ",
            node.name,
            node.constraint ? [" extends ", this.print(node.constraint)] : "",
        ]);
        p.handle(["TSTypeQuery"], (node) => [
            "typeof ",
            this.print(node.exprName),
            this.print(node.typeArguments),
        ]);
        p.handle(["TSImportType"], (node) => [
            "import(",
            this.print(node.argument),
            node.options ? [", ", this.print(node.options)] : "",
            ")",
            node.qualifier ? [".", this.print(node.qualifier)] : "",
            this.print(node.typeArguments),
        ]);
        p.handle(["TSTypePredicate"], (node) => [
            node.asserts ? "asserts " : "",
            this.print(node.parameterName),
            node.typeAnnotation
                ? [" is ", this.print(node.typeAnnotation)]
                : "",
        ]);
        p.handle(["TSUnionType"], (node) => this.#union(node));
        p.handle(["TSIntersectionType"], (node) => this.#intersection(node));
        p.handle(["TSConditionalType"], (node) => expressions().ternary(node));
        p.handle(["TSFunctionType", "TSConstructorType"], (node) =>
            this.#functionType(node),
        );
        p.handle(["TSTupleType"], (node) => this.#tuple(node));
        p.handle(["TSNamedTupleMember"], (node) => [
            this.print(node.label),
            node.optional ? "?" : "",
            ": ",
            this.print(node.elementType),
        ]);
        p.handle(["TSOptionalType"], (node) => [
            this.print(node.typeAnnotation),
            "?",
        ]);
        p.handle(["TSRestType"], (node) => [
            "...",
            this.print(node.typeAnnotation),
        ]);
        p.handle(["TSParenthesizedType"], (node) =>
            this.print(node.typeAnnotation),
        );
        p.handle(["TSMappedType"], (node) => this.#mapped(node));

        p.handle(["TSPropertySignature"], (node) => [
            node.readonly ? "readonly " : "",
            expressions().propertyKey(node),
            node.optional ? "?" : "",
            expressions().typeAnnotation(node.typeAnnotation),
        ]);
        p.handle(["TSMethodSignature"], (node) => [
            node.kind === "get" || node.kind === "set" ? `${node.kind} ` : "",
            expressions().propertyKey(node),
            node.optional ? "?" : "",
            this.#signature(node),
        ]);
        p.handle(["TSCallSignatureDeclaration"], (node) =>
            this.#signature(node),
        );
        p.handle(["TSConstructSignatureDeclaration"], (node) => [
            "new ",
            this.#signature(node),
        ]);
        p.handle(["TSIndexSignature"], (node) => {
            const parent = p.parent();
            return [
                node.static ? "static " : "",
                node.readonly ? "readonly " : "",
                "[",
                node.parameters.length > 0
                    ? join(
                          ", ",
                          node.parameters.map((parameter) =>
                              this.print(parameter),
                          ),
                      )
                    : "",
                "]",
                expressions().typeAnnotation(node.typeAnnotation),
                parent?.type === "ClassBody" ? p.semi : "",
            ];
        });
    }

    /** `T extends Constraint = Default`, the constraint breaking like an assignment. */
    #typeParameter(node: NodeOf<"TSTypeParameter">): Doc {
        const parts: Doc[] = [
            node.const ? "const " : "",
            node.in ? "in " : "",
            node.out ? "out " : "",
            node.name,
        ];
        if (node.constraint) {
            const id = Symbol("constraint");
            parts.push(
                " extends",
                group(indent(line), { id }),
                lineSuffixBoundary,
                indentIfBreak(this.print(node.constraint), id),
            );
        }
        if (node.default) parts.push(" = ", this.print(node.default));
        return group(parts);
    }

    #signature(
        node: NodeOf<
            | "TSCallSignatureDeclaration"
            | "TSConstructSignatureDeclaration"
            | "TSMethodSignature"
        >,
    ): Doc {
        const functions = this.printer.section(Functions);
        return [
            this.print(node.typeParameters),
            group([functions.parameters(node), functions.returnType(node)]),
        ];
    }

    #interface(node: NodeOf<"TSInterfaceDeclaration">): Doc {
        const parts: Doc[] = [node.declare ? "declare " : "", "interface"];
        const head: Doc[] = [
            " ",
            this.print(node.id),
            this.print(node.typeParameters),
        ];
        const extendsParts: Doc[] = [];
        const indentOnlyHeritage =
            node.typeParameters !== null &&
            !this.printer.hasTrailingComment(node.typeParameters);

        if (node.extends.length > 0) {
            const list = join(
                [",", line],
                node.extends.map((type) => this.print(type)),
            );
            extendsParts.push(
                // broken type parameters keep `> extends A {` together
                indentOnlyHeritage && node.typeParameters
                    ? ifBreak(
                          " ",
                          line,
                          this.printer.groupId(node.typeParameters),
                      )
                    : line,
                "extends ",
                node.extends.length === 1 ? list : indent(list),
            );
        }

        if (
            this.printer.hasTrailingComment(node.id) ||
            node.extends.length > 0
        ) {
            parts.push(
                indentOnlyHeritage
                    ? group([...head, indent(extendsParts)])
                    : group(indent([...head, ...extendsParts])),
            );
        } else parts.push(...head, ...extendsParts);

        parts.push(" ", this.print(node.body));
        return group(parts);
    }

    #enum(node: NodeOf<"TSEnumDeclaration">): Doc {
        const head: Doc = [
            node.declare ? "declare " : "",
            node.const ? "const " : "",
            "enum ",
            this.print(node.id),
            " ",
        ];
        if (node.members.length === 0) {
            const dangling = this.printer.dangling(node);
            return [
                head,
                dangling === "" ? "{}" : group(["{", dangling, softline, "}"]),
            ];
        }
        const members: Doc[] = [];
        for (const [index, member] of node.members.entries()) {
            members.push(this.print(member));
            if (index < node.members.length - 1) {
                members.push(",", hardline);
                if (this.printer.isNextLineEmpty(member.end))
                    members.push(hardline);
            }
        }
        return [
            head,
            "{",
            indent([
                hardline,
                members,
                this.options.trailingCommas === "none" ? "" : ",",
            ]),
            hardline,
            "}",
        ];
    }

    #module(node: NodeOf<"TSModuleDeclaration">): Doc {
        const parts: Doc[] = [node.declare ? "declare " : ""];
        if (node.kind !== "global") parts.push(node.kind, " ");
        parts.push(this.print(node.id));
        if (!node.body) return [parts, this.printer.semi];
        parts.push(" ", this.printer.section(Statements).block(node.body));
        return parts;
    }

    #typeParameters(
        node: NodeOf<
            "TSTypeParameterDeclaration" | "TSTypeParameterInstantiation"
        >,
    ): Doc {
        const params = node.params;
        if (params.length === 0) return "<>";
        const printed = params.map((param) => this.print(param));
        const [first] = params as [Node];
        const shouldInline =
            params.length === 1 &&
            (Expressions.isObjectType(first) ||
                this.#simple(first) ||
                this.#hugUnion(first));
        if (shouldInline) return ["<", join(", ", printed), ">"];

        const parent = this.printer.parent();
        const trailingComma =
            node.type === "TSTypeParameterInstantiation"
                ? ""
                : this.#tsxArrow(node, parent)
                  ? ","
                  : this.options.trailingCommas !== "none"
                    ? ifBreak(",")
                    : "";
        return group(
            [
                "<",
                indent([softline, join([",", line], printed)]),
                trailingComma,
                softline,
                ">",
            ],
            { id: this.printer.groupId(node) },
        );
    }

    /** `<T,>() => {}` in TSX keeps its comma, without it `<T>` reads as JSX. */
    #tsxArrow(
        node: NodeOf<
            "TSTypeParameterDeclaration" | "TSTypeParameterInstantiation"
        >,
        parent: Node | undefined,
    ): boolean {
        const [only] = node.params;
        return (
            this.options.typescript &&
            this.options.jsx &&
            parent?.type === "ArrowFunctionExpression" &&
            node.params.length === 1 &&
            only?.type === "TSTypeParameter" &&
            !only.constraint
        );
    }

    /** Keyword and literal types, and references without type arguments. */
    #simple(node: Node): boolean {
        if (
            node.type === "TSKeyword" ||
            node.type === "TSThisType" ||
            node.type === "TSLiteralType"
        )
            return true;
        return node.type === "TSTypeReference" && !node.typeArguments;
    }

    /** `Name | null` and `{ a: string } | null` hug like a single type. */
    #hugUnion(node: Node): boolean {
        if (node.type !== "TSUnionType") return false;
        const rest = node.types.filter(
            (type) =>
                !(
                    type.type === "TSKeyword" &&
                    (type.name === "void" || type.name === "null")
                ),
        );
        const [only] = rest;
        return (
            rest.length === 1 &&
            only !== undefined &&
            (only.type === "TSTypeReference" ||
                Expressions.isObjectType(only)) &&
            !node.types.some((type) => this.printer.hasComment(type))
        );
    }

    #hug(node: Node): boolean {
        return (
            this.#simple(node) ||
            Expressions.isObjectType(node) ||
            this.#hugUnion(node)
        );
    }

    /** Unions print inline, or one member per line with leading `|`. */
    #union(node: NodeOf<"TSUnionType">): Doc {
        const parent = this.printer.parent() as Node;
        const shouldIndent =
            parent.type !== "TSTypeParameterInstantiation" &&
            parent.type !== "TSTypeReference" &&
            parent.type !== "TSTypeAssertion" &&
            parent.type !== "TSTupleType" &&
            !(
                parent.type === "TSTypeAliasDeclaration" &&
                this.printer.hasLeadingOwnLineComment(node)
            );
        const shouldHug = this.#hug(node);

        const printed = node.types.map((type) => {
            const doc = this.printer.printBare(type);
            const aligned = shouldHug ? doc : align(2, doc);
            return this.printer.withComments(type, aligned);
        });
        if (shouldHug) return join(" | ", printed);

        const shouldAddStartLine =
            shouldIndent && !this.printer.hasLeadingOwnLineComment(node);
        const code: Doc = [
            ifBreak([shouldAddStartLine ? line : "", "| "]),
            join([line, "| "], printed),
        ];

        if (this.printer.needsParentheses(node))
            return group([indent(code), softline]);
        if (parent.type === "TSTupleType" && parent.elementTypes.length > 1)
            return group([
                indent([ifBreak(["(", softline]), code]),
                softline,
                ifBreak(")"),
            ]);
        return group(shouldIndent ? indent(code) : code);
    }

    #intersection(node: NodeOf<"TSIntersectionType">): Doc {
        const types = node.types.map((type) => this.print(type));
        const result: Doc[] = [];
        let wasIndented = false;
        for (const [index, type] of node.types.entries()) {
            const printed = types[index] as Doc;
            if (index === 0) result.push(printed);
            else {
                const previous = node.types[index - 1] as Node;
                if (
                    !Expressions.isObjectType(previous) &&
                    !Expressions.isObjectType(type)
                )
                    result.push(indent([" &", line, printed]));
                else if (
                    Expressions.isObjectType(previous) &&
                    Expressions.isObjectType(type)
                )
                    result.push(" & ", wasIndented ? indent(printed) : printed);
                else {
                    if (index > 1) wasIndented = true;
                    result.push(" & ", index > 1 ? indent(printed) : printed);
                }
            }
        }
        return group(result);
    }

    #functionType(node: NodeOf<"TSConstructorType" | "TSFunctionType">): Doc {
        const functions = this.printer.section(Functions);
        const signature: Doc = [
            functions.parameters(node),
            " => ",
            this.print(node.returnType),
        ];
        if (node.type === "TSFunctionType")
            return [this.print(node.typeParameters), group(signature)];
        return [
            node.abstract ? "abstract " : "",
            "new ",
            this.print(node.typeParameters),
            signature,
        ];
    }

    #tuple(node: NodeOf<"TSTupleType">): Doc {
        if (node.elementTypes.length === 0) {
            const dangling = this.printer.dangling(node);
            return dangling === ""
                ? "[]"
                : group(["[", dangling, softline, "]"]);
        }
        const printed = join(
            [",", line],
            node.elementTypes.map((type) => this.print(type)),
        );
        return group(
            [
                "[",
                indent([softline, printed]),
                ifBreak(this.options.trailingCommas === "none" ? "" : ","),
                softline,
                "]",
            ],
            { shouldBreak: this.options.expand === "always" },
        );
    }

    #mapped(node: NodeOf<"TSMappedType">): Doc {
        const shouldBreak =
            this.options.expand === "always" ||
            (this.options.expand === "auto" &&
                this.printer.hasNewlineInRange(
                    node.start,
                    this.printer.source.indexOf("[", node.start),
                ));
        const modifier = (value: string | null, keyword: string) =>
            value === "+" || value === "-" ? value + keyword : keyword;
        const spacing = this.options.bracketSpacing ? line : softline;
        const constraintStart = this.print(node.constraint);
        return group(
            [
                "{",
                indent([
                    spacing,
                    group([
                        node.readonly
                            ? [modifier(node.readonly, "readonly"), " "]
                            : "",
                        "[",
                        node.key,
                        " in ",
                        constraintStart,
                        node.nameType
                            ? [" as ", this.print(node.nameType)]
                            : "",
                        "]",
                        node.optional ? modifier(node.optional, "?") : "",
                        node.typeAnnotation ? ": " : "",
                        this.print(node.typeAnnotation),
                    ]),
                    this.options.semicolons ? ifBreak(";") : "",
                ]),
                this.printer.dangling(node),
                spacing,
                "}",
            ],
            { shouldBreak },
        );
    }

    static isObjectType(node: Node): boolean {
        return Expressions.isObjectType(node) || Nodes.isObjectOrRecord(node);
    }
}
