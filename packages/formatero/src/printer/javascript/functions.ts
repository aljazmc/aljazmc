import type { Node, NodeOf } from "@aljazmc/syntax";
import {
    type Doc,
    group,
    hardline,
    ifBreak,
    indent,
    indentIfBreak,
    join,
    line,
    removeLines,
    reserve,
    softline,
    willBreak,
} from "../doc.js";
import { ArgumentExpansionBailout } from "./calls.js";
import Expressions from "./expressions.js";
import Nodes from "./nodes.js";
import type { Args } from "./printer.js";
import Section from "./section.js";

/** Functions, methods, arrow functions and their parameters. */
export default class Functions extends Section {
    override register(): void {
        const p = this.printer;
        p.handle(
            ["FunctionDeclaration", "FunctionExpression", "TSDeclareFunction"],
            (node, args) => this.#function(node, args),
        );
        p.handle(["ArrowFunctionExpression"], (node, args) =>
            this.#arrow(node, args),
        );
    }

    #function(
        node: NodeOf<
            "FunctionDeclaration" | "FunctionExpression" | "TSDeclareFunction"
        >,
        args: Args,
    ): Doc {
        const parent = this.printer.parent();
        if (
            node.type === "FunctionExpression" &&
            this.#isMethodValue(node, parent)
        )
            return this.methodValue(node);

        let expandArg = false;
        if (
            node.type !== "TSDeclareFunction" &&
            args.expandLastArg &&
            (parent?.type === "CallExpression" ||
                parent?.type === "NewExpression")
        ) {
            expandArg =
                parent.arguments.length > 1 ||
                node.params.every(
                    (param) =>
                        param.type === "Identifier" && !param.typeAnnotation,
                );
        }

        const parameters = this.parameters(node, expandArg);
        const returnType = this.returnType(node);
        const parts: Doc[] = [
            "declare" in node && node.declare ? "declare " : "",
            node.async ? "async " : "",
            `function${node.generator ? "*" : ""} `,
            node.id ? this.print(node.id) : "",
            this.print(node.typeParameters),
            group([
                this.#shouldGroupParameters(node, returnType)
                    ? group(parameters)
                    : parameters,
                returnType,
            ]),
            node.body ? " " : "",
            this.print(node.body),
        ];
        if (
            this.options.semicolons &&
            (("declare" in node && node.declare) || !node.body)
        )
            parts.push(";");
        return parts;
    }

    #isMethodValue(node: Node, parent: Node | undefined): boolean {
        if (!parent) return false;
        if (parent.type === "MethodDefinition") return parent.value === node;
        if (parent.type === "Property")
            return (
                parent.value === node &&
                (parent.method || parent.kind !== "init")
            );
        return false;
    }

    /** The part of a method after its name: type parameters, parameters, return type and body. */
    methodValue(node: NodeOf<"FunctionExpression">): Doc {
        const parameters = this.parameters(node);
        const returnType = this.returnType(node);
        const breakParameters =
            node.params.length > 1 &&
            node.params.some((param) => param.type === "TSParameterProperty");
        const parts: Doc[] = [
            this.print(node.typeParameters),
            group([
                breakParameters
                    ? group(parameters, { shouldBreak: true })
                    : this.#shouldGroupParameters(node, returnType)
                      ? group(parameters)
                      : parameters,
                returnType,
            ]),
        ];
        if (node.body) parts.push(" ", this.print(node.body));
        return parts;
    }

    returnType(node: { returnType: Node | null }): Doc {
        return node.returnType ? [": ", this.print(node.returnType)] : "";
    }

    #shouldGroupParameters(
        node: {
            params: Node[];
            typeParameters: NodeOf<"TSTypeParameterDeclaration"> | null;
            returnType: Node | null;
        },
        returnType: Doc,
    ): boolean {
        const typeParameters = node.typeParameters?.params;
        if (typeParameters) {
            if (typeParameters.length > 1) return false;
            const [parameter] = typeParameters;
            if (parameter && (parameter.constraint || parameter.default))
                return false;
        }
        const returned = node.returnType;
        return (
            node.params.length === 1 &&
            ((returned !== null && Expressions.isObjectType(returned)) ||
                willBreak(returnType))
        );
    }

    /** Prints `(a, b)` parameter lists, after Prettier's printFunctionParameters. */
    parameters(node: { params: Node[] } & Node, expandArg = false): Doc {
        const { params } = node;
        if (params.length === 0) {
            return [
                "(",
                this.printer.dangling(node, {
                    filter: (comment) =>
                        this.#nextCharacter(comment.end) === ")",
                }),
                ")",
            ];
        }

        const printed: Doc[] = [];
        for (const [index, param] of params.entries()) {
            printed.push(this.print(param));
            if (index === params.length - 1) break;
            printed.push(",");
            printed.push(
                this.printer.isNextLineEmpty(param.end)
                    ? [hardline, hardline]
                    : line,
            );
        }

        if (
            expandArg &&
            !params.some((param) => this.printer.hasComment(param))
        ) {
            if (willBreak(printed)) throw new ArgumentExpansionBailout();
            return group(["(", removeLines(printed), ")"]);
        }

        if (this.printer.section(Expressions).shouldHugTheOnlyParameter(node))
            return ["(", ...printed, ")"];

        const parent = this.printer.parent();
        if (
            parent &&
            Nodes.isTestCall(parent, this.printer.parent(1)) &&
            (parent as NodeOf<"CallExpression">).arguments.includes(node)
        )
            return ["(", ...printed, ")"];

        const rest = params.at(-1)?.type === "RestElement";
        return [
            "(",
            indent([softline, ...printed]),
            ifBreak(!rest && this.options.trailingCommas === "all" ? "," : ""),
            softline,
            ")",
        ];
    }

    #nextCharacter(index: number): string {
        const match = /^(?:\s|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*(\S)/.exec(
            this.printer.source.slice(index),
        );
        return match?.[1] ?? "";
    }

    // Arrow functions

    #arrow(node: NodeOf<"ArrowFunctionExpression">, args: Args): Doc {
        const signatures: Doc[] = [];
        const bodyComments: Doc[] = [];
        let tail = node;
        let chainShouldBreak = false;
        let body: Doc = "";

        const collect = (current: NodeOf<"ArrowFunctionExpression">): void => {
            const signature = this.#signature(current, args);
            signatures.push(
                signatures.length === 0
                    ? signature
                    : this.printer.withComments(current, signature),
            );
            chainShouldBreak ||=
                (current.returnType !== null && current.params.length > 0) ||
                current.typeParameters !== null ||
                current.params.some((param) => param.type !== "Identifier");
            if (
                current.body.type !== "ArrowFunctionExpression" ||
                args.expandLastArg
            ) {
                tail = current;
                body = this.print(current.body, args);
            } else {
                this.printer.within(current.body, () =>
                    collect(current.body as NodeOf<"ArrowFunctionExpression">),
                );
            }
        };
        collect(node);

        if (signatures.length > 1)
            return this.#chain(
                node,
                tail,
                signatures,
                body,
                chainShouldBreak,
                args,
            );

        const parts: Doc[] = [...signatures, " =>"];
        const tailBody = tail.body;

        if (
            !this.printer.hasLeadingOwnLineComment(tailBody) &&
            (tailBody.type === "ArrayExpression" ||
                tailBody.type === "ObjectExpression" ||
                tailBody.type === "BlockStatement" ||
                Nodes.isJsx(tailBody) ||
                Nodes.isTemplateOnItsOwnLine(tailBody, this.printer.source) ||
                tailBody.type === "ArrowFunctionExpression")
        )
            return group([...parts, " ", body, bodyComments]);

        if (tailBody.type === "SequenceExpression")
            return group([
                ...parts,
                group([" (", indent([softline, body]), softline, ")"]),
            ]);

        const parent = this.printer.parent();
        const shouldAddSoftLine =
            (args.expandLastArg || parent?.type === "JSXExpressionContainer") &&
            !this.printer.hasComment(node);
        const printTrailingComma =
            args.expandLastArg && this.options.trailingCommas === "all";
        const shouldAddParens =
            tailBody.type === "ConditionalExpression" &&
            Nodes.leftmost(tailBody).type !== "ObjectExpression";

        return group([
            ...parts,
            // Biome needs a spare column after `=>` before a parenthesized conditional
            shouldAddParens ? reserve(1) : "",
            group([
                indent([
                    line,
                    shouldAddParens ? ifBreak("", "(") : "",
                    body,
                    shouldAddParens ? ifBreak("", ")") : "",
                ]),
                shouldAddSoftLine
                    ? [ifBreak(printTrailingComma ? "," : ""), softline]
                    : "",
            ]),
        ]);
    }

    #chain(
        node: NodeOf<"ArrowFunctionExpression">,
        tail: NodeOf<"ArrowFunctionExpression">,
        signatures: Doc[],
        bodyDoc: Doc,
        chainShouldBreak: boolean,
        args: Args,
    ): Doc {
        const parent = this.printer.parent();
        const isCallee =
            Nodes.isCall(parent) &&
            parent.type !== "ImportExpression" &&
            parent.callee === node;
        const isAssignmentRhs = args.assignmentLayout !== undefined;
        const separateLine =
            tail.body.type !== "BlockStatement" &&
            tail.body.type !== "ObjectExpression" &&
            tail.body.type !== "SequenceExpression";
        const breakBeforeChain =
            (isCallee && separateLine) ||
            args.assignmentLayout === "chain-tail-arrow-chain";
        const id = Symbol("arrow-chain");
        const body =
            tail.body.type === "SequenceExpression"
                ? group(["(", indent([softline, bodyDoc]), softline, ")"])
                : bodyDoc;

        return group([
            group(
                indent([
                    isCallee || isAssignmentRhs ? softline : "",
                    group(join([" =>", line], signatures), {
                        shouldBreak: chainShouldBreak,
                    }),
                ]),
                {
                    shouldBreak: breakBeforeChain,
                    id,
                },
            ),
            " =>",
            // a block body moves in with the signatures when they break
            indentIfBreak(
                separateLine ? indent([line, body]) : [" ", body],
                id,
            ),
            isCallee ? softline : "",
        ]);
    }

    #signature(node: NodeOf<"ArrowFunctionExpression">, args: Args): Doc {
        const parts: Doc[] = [node.async ? "async " : ""];
        const [param] = node.params;

        if (this.#withoutParens(node) && param) parts.push(this.print(param));
        else {
            const expandArg =
                args.expandLastArg === true || args.expandFirstArg === true;
            let returnType = this.returnType(node);
            if (expandArg) {
                if (willBreak(returnType)) throw new ArgumentExpansionBailout();
                returnType = group(removeLines(returnType));
            }
            const parameters = [
                this.print(node.typeParameters),
                this.parameters(node, expandArg),
            ];
            parts.push(
                group([
                    this.#shouldGroupParameters(node, returnType)
                        ? group(parameters)
                        : parameters,
                    returnType,
                ]),
            );
        }

        const dangling = this.printer.dangling(node, {
            filter: (comment) =>
                this.printer.source.slice(
                    this.#skip(comment.end),
                    this.#skip(comment.end) + 2,
                ) === "=>",
        });
        if (dangling !== "") parts.push(" ", dangling);
        return parts;
    }

    #skip(index: number): number {
        const match = /^(?:\s|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*/.exec(
            this.printer.source.slice(index),
        );
        return index + (match?.[0].length ?? 0);
    }

    #withoutParens(node: NodeOf<"ArrowFunctionExpression">): boolean {
        if (this.options.arrowParentheses === "always") return false;
        const [param] = node.params;
        return (
            node.params.length === 1 &&
            !node.typeParameters &&
            !this.printer.hasDangling(node) &&
            param?.type === "Identifier" &&
            !param.typeAnnotation &&
            !this.printer.hasComment(param) &&
            !param.optional &&
            !node.returnType
        );
    }
}
