import type { Node, NodeOf } from "@aljazmc/syntax";
import {
    canBreak,
    type Doc,
    group,
    indent,
    indentIfBreak,
    line,
    text,
} from "../doc.js";
import Layout from "../layout.js";
import Calls from "./calls.js";
import Nodes from "./nodes.js";
import Section from "./section.js";

type AssignmentLayout =
    | "break-after-operator"
    | "break-lhs"
    | "chain"
    | "chain-tail"
    | "chain-tail-arrow-chain"
    | "fluid"
    | "never-break-after-operator"
    | "only-left";

/** Assignment-like layouts, after Prettier's printAssignment. */
export default class Assignments extends Section {
    override register(): void {
        this.printer.handle(["AssignmentExpression"], (node) =>
            this.printAssignment(
                node,
                this.print(node.left),
                [" ", node.operator],
                node.right,
            ),
        );
        this.printer.handle(["VariableDeclarator"], (node) =>
            this.printAssignment(node, this.print(node.id), " =", node.init),
        );
    }

    /** Prints `left operator right` choosing a layout for the line breaks. */
    printAssignment(
        node: Node,
        left: Doc,
        operator: Doc,
        right: Node | null | undefined,
    ): Doc {
        const layout = this.#layout(node, left, right);
        const rightDoc = right
            ? this.printer.print(right, { assignmentLayout: layout })
            : "";

        switch (layout) {
            case "break-after-operator":
                return group([
                    group(left),
                    operator,
                    group(indent([line, rightDoc])),
                ]);
            case "never-break-after-operator":
                return group([group(left), operator, " ", rightDoc]);
            case "fluid": {
                const id = Symbol("assignment");
                return group([
                    group(left),
                    operator,
                    group(indent(line), { id }),
                    indentIfBreak(rightDoc, id),
                ]);
            }
            case "break-lhs":
                return group([left, operator, " ", group(rightDoc)]);

            case "chain":
                return [group(left), operator, line, rightDoc];
            case "chain-tail":
                return [group(left), operator, indent([line, rightDoc])];
            case "chain-tail-arrow-chain":
                return [group(left), operator, group(rightDoc)];
            case "only-left":
                return left;
        }
    }

    #layout(
        node: Node,
        left: Doc,
        right: Node | null | undefined,
    ): AssignmentLayout {
        if (!right) return "only-left";

        const isTail = !Assignments.#isAssignment(right);
        const parent = this.printer.parent();
        const grandparent = this.printer.parent(1);
        const chain =
            Assignments.#isAssignment(node) &&
            (parent?.type === "AssignmentExpression" ||
                parent?.type === "VariableDeclarator") &&
            (!isTail ||
                (grandparent?.type !== "ExpressionStatement" &&
                    grandparent?.type !== "VariableDeclaration"));
        if (chain) {
            if (!isTail) return "chain";
            return Assignments.#arrowChain(right)
                ? "chain-tail-arrow-chain"
                : "chain-tail";
        }

        const isHeadOfLongChain =
            !isTail &&
            Assignments.#isAssignment(
                (right as NodeOf<"AssignmentExpression">).right,
            );
        if (isHeadOfLongChain || this.printer.hasLeadingOwnLineComment(right))
            return "break-after-operator";
        if (
            this.options.json ||
            (right.type === "CallExpression" &&
                right.callee.type === "Identifier" &&
                right.callee.name === "require")
        )
            return "never-break-after-operator";

        // like Biome, conditional types on generic types move after `=`
        if (right.type === "TSConditionalType") {
            const generic = (type: Node) =>
                type.type === "TSTypeReference" && type.typeArguments !== null;
            if (generic(right.checkType) || generic(right.extendsType))
                return "break-after-operator";
            return this.#complexTypeAliasParams(node) ? "break-lhs" : "fluid";
        }
        if (
            this.#complexDestructuring(node) ||
            this.#complexTypeAliasParams(node) ||
            this.#complexTypeAnnotation(node) ||
            (this.#arrowVariable(node) && canBreak(left))
        )
            return "break-lhs";
        const hasShortKey = this.#shortKey(node, left);
        if (this.#breakAfterOperator(right, hasShortKey))
            return "break-after-operator";
        if (
            !canBreak(left) &&
            (hasShortKey ||
                right.type === "TemplateLiteral" ||
                right.type === "TaggedTemplateExpression" ||
                right.type === "BooleanLiteral" ||
                right.type === "NumericLiteral" ||
                right.type === "ClassExpression" ||
                Assignments.#arrowChain(right))
        )
            return "never-break-after-operator";

        if (this.#arrowVariable(node) || Assignments.#arrowChain(right))
            return "chain-tail-arrow-chain";
        if (
            this.#poorlyBreakableChain(right) ||
            Assignments.#requireMember(right)
        )
            return "break-after-operator";
        return "fluid";
    }

    /** `require("x").y` moves after `=` whole, like Biome does. */
    static #requireMember(node: Node): boolean {
        let current = node;
        if (!Nodes.isMember(current)) return false;
        while (Nodes.isMember(current)) current = current.object;
        return (
            current.type === "CallExpression" &&
            current.callee.type === "Identifier" &&
            current.callee.name === "require"
        );
    }

    static #arrowChain(node: Node): boolean {
        return (
            node.type === "ArrowFunctionExpression" &&
            node.body.type === "ArrowFunctionExpression"
        );
    }

    static #isAssignment(node: Node): boolean {
        return node.type === "AssignmentExpression";
    }

    #breakAfterOperator(right: Node, hasShortKey: boolean): boolean {
        if (Nodes.isBinaryish(right) && !Nodes.shouldInlineLogical(right))
            return true;
        switch (right.type) {
            case "SequenceExpression":
                return true;
            case "TSConditionalType":
            case "ConditionalExpression": {
                const test =
                    right.type === "ConditionalExpression"
                        ? right.test
                        : right.checkType;
                return (
                    Nodes.isBinaryish(test) && !Nodes.shouldInlineLogical(test)
                );
            }
            case "ClassExpression":
                return right.decorators.length > 0;
        }
        if (hasShortKey) return false;

        let inner: Node = right;
        for (;;) {
            if (
                inner.type === "UnaryExpression" ||
                inner.type === "AwaitExpression" ||
                (inner.type === "YieldExpression" && inner.argument)
            )
                inner = (inner as { argument: Node }).argument;
            else if (inner.type === "TSNonNullExpression")
                inner = inner.expression;
            else break;
        }
        return Nodes.isString(inner) || Nodes.isMemberChain(inner);
    }

    /** Object properties with keys shorter than the indentation do not break after `:`. */
    #shortKey(node: Node, left: Doc): boolean {
        if (node.type !== "Property") return false;
        const key = text(left);
        return (
            key !== undefined &&
            Layout.width(key) < this.options.indentWidth + 3
        );
    }

    #complexDestructuring(node: Node): boolean {
        if (
            node.type !== "AssignmentExpression" &&
            node.type !== "VariableDeclarator"
        )
            return false;
        const left = node.type === "AssignmentExpression" ? node.left : node.id;
        if (left.type !== "ObjectPattern" && left.type !== "ObjectExpression")
            return false;
        const properties = left.properties;
        return (
            properties.length > 2 &&
            properties.some(
                (property) =>
                    property.type === "Property" &&
                    (!property.shorthand ||
                        property.value.type === "AssignmentPattern"),
            )
        );
    }

    /** Type aliases with several type parameters having constraints or defaults. */
    #complexTypeAliasParams(node: Node): boolean {
        if (node.type !== "TSTypeAliasDeclaration" || !node.typeParameters)
            return false;
        const { params } = node.typeParameters;
        return (
            params.length > 1 &&
            params.some(
                (param) => param.constraint !== null || param.default !== null,
            )
        );
    }

    #complexTypeAnnotation(node: Node): boolean {
        if (node.type !== "VariableDeclarator") return false;
        const annotation = (node.id as { typeAnnotation?: Node | null })
            .typeAnnotation;
        if (annotation?.type !== "TSTypeReference" || !annotation.typeArguments)
            return false;
        const args = annotation.typeArguments.params;
        return (
            args.length > 1 &&
            args.some(
                (arg) =>
                    arg.type === "TSTypeLiteral" ||
                    arg.type === "TSConditionalType",
            )
        );
    }

    #arrowVariable(node: Node): boolean {
        return (
            node.type === "VariableDeclarator" &&
            node.init?.type === "ArrowFunctionExpression" &&
            (node.init.typeParameters?.params.length ?? 0) > 0
        );
    }

    /** A chain without calls, or with calls with no or short arguments, that is no full member chain. */
    #poorlyBreakableChain(node: Node): boolean {
        const start = node.type === "AwaitExpression" ? node.argument : node;
        if (this.printer.section(Calls).isLongChain(start)) return false;
        let current = start;
        let chain = false;
        for (;;) {
            if (current.type === "TSNonNullExpression")
                current = current.expression;
            else if (Nodes.isMember(current)) current = current.object;
            else if (current.type === "CallExpression") {
                const short =
                    current.arguments.length === 0 ||
                    (current.arguments.length === 1 &&
                        this.#shortArgument(current.arguments[0] as Node));
                if (
                    !short ||
                    (current.typeArguments &&
                        current.typeArguments.params.length > 1)
                )
                    return false;
                current = current.callee;
            } else break;
            chain = true;
        }
        return (
            chain &&
            (current.type === "Identifier" || current.type === "ThisExpression")
        );
    }

    #shortArgument(node: Node): boolean {
        if (this.printer.hasComment(node)) return false;
        const threshold = this.options.lineWidth / 4;
        if (
            node.type === "ThisExpression" ||
            (node.type === "Identifier" && node.name.length <= threshold)
        )
            return true;
        if (
            node.type === "UnaryExpression" &&
            node.operator === "-" &&
            node.argument.type === "NumericLiteral"
        )
            return true;
        if (node.type === "RegExpLiteral")
            return node.raw.lastIndexOf("/") - 1 <= threshold;
        if (node.type === "StringLiteral") return node.raw.length <= threshold;
        if (node.type === "TemplateLiteral") {
            const [quasi] = node.quasis;
            return (
                node.expressions.length === 0 &&
                quasi !== undefined &&
                quasi.raw.length <= threshold &&
                !quasi.raw.includes("\n")
            );
        }
        return Nodes.isLiteral(node);
    }
}
