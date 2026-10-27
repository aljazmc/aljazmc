import type { Node, NodeOf } from "@aljazmc/syntax";
import Nodes from "./nodes.js";
import type Printer from "./printer.js";

/** Decides where parentheses are needed, after Prettier's needsParens. */
export default class Parentheses {
    readonly #printer: Printer;

    constructor(printer: Printer) {
        this.#printer = printer;
    }

    needs(node: Node): boolean {
        const parent = this.#printer.parent();
        if (!parent || this.#printer.options.json) return false;
        if (node.parenthesized && this.#typeCast(node)) return true;
        return this.#rule(node, parent) || this.#statementStart(node);
    }

    /** `/** @type {T} *\/ (value)` is a JSDoc type cast, its parentheses matter. */
    #typeCast(node: Node): boolean {
        return (
            node.comments?.some(
                (comment) =>
                    comment.placement === "leading" &&
                    comment.type === "Block" &&
                    /^\/\*\*\s*@(?:type|satisfies)\b/.test(comment.value),
            ) ?? false
        );
    }

    #rule(node: Node, parent: Node): boolean {
        switch (node.type) {
            case "SpreadElement":
                return false;
            case "UpdateExpression":
                if (parent.type === "UnaryExpression")
                    return (
                        node.prefix &&
                        ((node.operator === "++" && parent.operator === "+") ||
                            (node.operator === "--" && parent.operator === "-"))
                    );
                return this.#unary(node, parent);
            case "UnaryExpression":
                return this.#unary(node, parent);
            case "BinaryExpression":
                if (parent.type === "UpdateExpression") return true;
                if (node.operator === "in" && this.#inForInit()) return true;
                return this.#binary(node, parent);
            case "LogicalExpression":
                // `a ? (b ?? c) : d` clarifies nullish coalescing in conditionals
                if (
                    node.operator === "??" &&
                    parent.type === "ConditionalExpression"
                )
                    return true;
                return this.#binary(node, parent);
            case "TSAsExpression":
            case "TSSatisfiesExpression":
            case "TSTypeAssertion":
                return this.#binary(node, parent);
            case "SequenceExpression":
                switch (parent.type) {
                    case "ReturnStatement":
                    case "ForStatement":
                        return false;
                    case "ExpressionStatement":
                        return parent.expression !== node;
                    case "ArrowFunctionExpression":
                        return parent.body !== node;
                    default:
                        return true;
                }
            case "YieldExpression":
                if (
                    parent.type === "AwaitExpression" ||
                    parent.type === "TSTypeAssertion"
                )
                    return true;
                return this.#await(node, parent);
            case "AwaitExpression":
                return this.#await(node, parent);
            case "ConditionalExpression":
                switch (parent.type) {
                    case "TaggedTemplateExpression":
                    case "UnaryExpression":
                    case "SpreadElement":
                    case "BinaryExpression":
                    case "LogicalExpression":
                    case "ExportDefaultDeclaration":
                    case "AwaitExpression":
                    case "JSXSpreadAttribute":
                    case "TSTypeAssertion":
                    case "TSAsExpression":
                    case "TSSatisfiesExpression":
                    case "TSNonNullExpression":
                        return true;
                    case "NewExpression":
                    case "CallExpression":
                        return parent.callee === node;
                    case "ConditionalExpression":
                        return parent.test === node;
                    case "MemberExpression":
                        return parent.object === node;
                    default:
                        return false;
                }
            case "FunctionExpression":
                switch (parent.type) {
                    case "CallExpression":
                    case "NewExpression":
                        return parent.callee === node;
                    case "TaggedTemplateExpression":
                        return true;
                    default:
                        return false;
                }
            case "ArrowFunctionExpression":
                switch (parent.type) {
                    case "BinaryExpression":
                    case "TSAsExpression":
                    case "TSSatisfiesExpression":
                    case "TSNonNullExpression":
                    case "TaggedTemplateExpression":
                    case "UnaryExpression":
                    case "LogicalExpression":
                    case "AwaitExpression":
                    case "TSTypeAssertion":
                        return true;
                    case "NewExpression":
                    case "CallExpression":
                        return parent.callee === node;
                    case "MemberExpression":
                        return parent.object === node;
                    case "ConditionalExpression":
                        return parent.test === node;
                    default:
                        return false;
                }
            case "ClassExpression":
                if (node.decorators.length > 0) return true;
                return (
                    parent.type === "NewExpression" && parent.callee === node
                );
            case "AssignmentExpression":
                return this.#assignment(node, parent);
            case "ObjectExpression":
                return (
                    parent.type === "ArrowFunctionExpression" &&
                    parent.body === node
                );
            case "NumericLiteral":
                return (
                    parent.type === "MemberExpression" &&
                    parent.object === node &&
                    !parent.computed
                );
            case "CallExpression":
            case "MemberExpression":
            case "TaggedTemplateExpression":
            case "TSNonNullExpression":
                if (
                    node.parenthesized &&
                    this.#optionalChain(node) &&
                    ((parent.type === "CallExpression" &&
                        parent.callee === node) ||
                        (parent.type === "MemberExpression" &&
                            parent.object === node))
                )
                    return true;
                if (parent.type === "NewExpression" && parent.callee === node)
                    return this.#hasCall(node);
                return false;
            case "TSInstantiationExpression":
                // `(a<T>)<U>` and `(a<T>)!`: `a<T><U>` and `a<T>!` do not parse
                if (
                    parent.type === "TSInstantiationExpression" ||
                    parent.type === "TSNonNullExpression"
                )
                    return true;
                // `class A extends (B<T>)<U> {}`: `extends B<T><U>` does not parse
                if (
                    (parent.type === "ClassDeclaration" ||
                        parent.type === "ClassExpression") &&
                    parent.superClass === node &&
                    parent.superTypeArguments
                )
                    return true;
                if (this.#beforeTypeArgumentOperator(node)) return true;
                return (
                    parent.type === "MemberExpression" && parent.object === node
                );
            case "TSConditionalType":
            case "TSConstructorType":
            case "TSFunctionType":
                if (
                    parent.type === "TSConditionalType" &&
                    (parent.checkType === node ||
                        (parent.extendsType === node &&
                            this.#conditionalExtends(node)))
                )
                    return true;
                return (
                    this.#unionMember(node, parent) ||
                    this.#typeOperand(node, parent)
                );
            case "TSUnionType":
            case "TSIntersectionType":
                return (
                    this.#unionMember(node, parent) ||
                    this.#typeOperand(node, parent)
                );
            case "TSInferType":
                if (parent.type === "TSRestType") return false;
                if (
                    (parent.type === "TSUnionType" ||
                        parent.type === "TSIntersectionType") &&
                    node.constraint
                )
                    return true;
                return this.#typeOperand(node, parent);
            case "TSTypeOperator":
                return this.#typeOperand(node, parent);
            case "TSTypeQuery":
                return (
                    (parent.type === "TSArrayType" &&
                        parent.elementType === node) ||
                    (parent.type === "TSIndexedAccessType" &&
                        parent.objectType === node)
                );
            case "JSXElement":
                return false;
            default:
                return false;
        }
    }

    /** Array element, indexed object, operand of `keyof` and alike. */
    #typeOperand(node: Node, parent: Node): boolean {
        return (
            (parent.type === "TSArrayType" && parent.elementType === node) ||
            (parent.type === "TSIndexedAccessType" &&
                parent.objectType === node) ||
            parent.type === "TSTypeOperator" ||
            parent.type === "TSOptionalType"
        );
    }

    #unionMember(node: Node, parent: Node): boolean {
        if (
            parent.type !== "TSUnionType" &&
            parent.type !== "TSIntersectionType"
        )
            return false;
        return (
            parent.types.length > 1 &&
            (!(
                node.type === "TSUnionType" ||
                node.type === "TSIntersectionType"
            ) ||
                node.types.length > 1)
        );
    }

    /** Function types in a conditional's extends clause whose return type infers with a constraint. */
    #conditionalExtends(node: Node): boolean {
        if (node.type === "TSConditionalType") return true;
        if (node.type !== "TSFunctionType" && node.type !== "TSConstructorType")
            return false;
        let returned = node.returnType;
        if (returned.type === "TSTypePredicate" && returned.typeAnnotation)
            returned = returned.typeAnnotation;
        return returned.type === "TSInferType" && returned.constraint !== null;
    }

    /** Functions, classes, objects and `let[` must not start a statement. */
    #statementStart(node: Node): boolean {
        const letMember = node.type === "Identifier" && node.name === "let";
        if (
            node.type !== "FunctionExpression" &&
            node.type !== "ClassExpression" &&
            node.type !== "ObjectExpression" &&
            !letMember
        )
            return false;

        let child: Node = node;
        for (const ancestor of this.#printer.ancestors()) {
            switch (ancestor.type) {
                case "ExpressionStatement":
                    return true;
                case "ExportDefaultDeclaration":
                    return (
                        node.type === "FunctionExpression" ||
                        node.type === "ClassExpression"
                    );
                case "ArrowFunctionExpression":
                    return (
                        ancestor.body === child &&
                        node.type === "ObjectExpression"
                    );
                case "AssignmentExpression":
                    if (Nodes.isObjectOrRecord(ancestor.left)) return false;
            }
            if (!this.#leftOf(ancestor, child)) return false;
            if (
                letMember &&
                child === node &&
                !(ancestor.type === "MemberExpression" && ancestor.computed)
            )
                return false;
            child = ancestor;
        }
        return false;
    }

    #leftOf(ancestor: Node, child: Node): boolean {
        switch (ancestor.type) {
            case "BinaryExpression":
            case "LogicalExpression":
            case "AssignmentExpression":
                return ancestor.left === child;
            case "MemberExpression":
                return ancestor.object === child;
            case "CallExpression":
                return (
                    ancestor.callee === child &&
                    child.type !== "FunctionExpression"
                );
            case "TaggedTemplateExpression":
                return (
                    ancestor.tag === child &&
                    child.type !== "FunctionExpression"
                );
            case "ConditionalExpression":
                return ancestor.test === child;
            case "UpdateExpression":
                return !ancestor.prefix;
            case "SequenceExpression":
                return ancestor.expressions[0] === child;
            case "TSAsExpression":
            case "TSSatisfiesExpression":
            case "TSNonNullExpression":
                return ancestor.expression === child;
            default:
                return false;
        }
    }

    #unary(node: Node, parent: Node): boolean {
        switch (parent.type) {
            case "UnaryExpression":
                return (
                    node.type === "UnaryExpression" &&
                    node.operator === parent.operator &&
                    (node.operator === "+" || node.operator === "-")
                );
            case "MemberExpression":
                return parent.object === node;
            case "TaggedTemplateExpression":
            case "TSNonNullExpression":
                return true;
            case "NewExpression":
            case "CallExpression":
                return parent.callee === node;
            case "BinaryExpression":
                return parent.left === node && parent.operator === "**";
            default:
                return false;
        }
    }

    #binary(
        node: Node & {
            type:
                | "BinaryExpression"
                | "LogicalExpression"
                | "TSAsExpression"
                | "TSSatisfiesExpression"
                | "TSTypeAssertion";
        },
        parent: Node,
    ): boolean {
        const cast =
            node.type === "TSAsExpression" ||
            node.type === "TSSatisfiesExpression";

        switch (parent.type) {
            case "TSAsExpression":
            case "TSSatisfiesExpression":
                return !cast;
            case "ConditionalExpression":
                return cast;
            case "CallExpression":
            case "NewExpression":
                return parent.callee === node;
            case "ClassExpression":
            case "ClassDeclaration":
                return parent.superClass === node;
            case "TSTypeAssertion":
            case "TSInstantiationExpression":
            case "TaggedTemplateExpression":
            case "UnaryExpression":
            case "JSXSpreadAttribute":
            case "SpreadElement":
            case "AwaitExpression":
            case "TSNonNullExpression":
            case "UpdateExpression":
                return true;
            case "MemberExpression":
                return parent.object === node;
            case "AssignmentExpression":
            case "AssignmentPattern":
                return (
                    parent.left === node &&
                    (node.type === "TSTypeAssertion" || cast)
                );
            case "LogicalExpression":
            case "BinaryExpression": {
                if (node.type === "TSTypeAssertion") return false;
                if (cast) return true;
                const precedence = Nodes.precedence(node.operator);
                const parentPrecedence = Nodes.precedence(parent.operator);
                if (parentPrecedence > precedence) return true;
                if (parent.right === node && parentPrecedence === precedence)
                    return true;
                if (
                    parentPrecedence === precedence &&
                    !Nodes.shouldFlatten(parent.operator, node.operator)
                )
                    return true;
                if (parentPrecedence < precedence && node.operator === "%")
                    return parent.operator === "+" || parent.operator === "-";
                if (Nodes.isBitwise(parent.operator)) return true;
                // mixed logical operators are clarified: `(a && b) || c`
                if (
                    parent.type === "LogicalExpression" &&
                    node.type === "LogicalExpression" &&
                    parent.operator !== node.operator
                )
                    return true;
                return false;
            }
            default:
                return false;
        }
    }

    #await(node: Node, parent: Node): boolean {
        switch (parent.type) {
            case "TaggedTemplateExpression":
            case "UnaryExpression":
            case "LogicalExpression":
            case "SpreadElement":
            case "TSAsExpression":
            case "TSSatisfiesExpression":
            case "TSNonNullExpression":
            case "BinaryExpression":
                return true;
            case "MemberExpression":
                return parent.object === node;
            case "NewExpression":
            case "CallExpression":
                return parent.callee === node;
            case "ConditionalExpression":
                return parent.test === node;
            default:
                return false;
        }
    }

    /** Assignments used as values are parenthesized, except in chains and loop heads. */
    #assignment(node: NodeOf<"AssignmentExpression">, parent: Node): boolean {
        switch (parent.type) {
            case "ExpressionStatement":
                return Nodes.isObjectOrRecord(node.left);
            case "AssignmentExpression":
                return parent.right !== node;
            case "ForStatement":
                return parent.init !== node && parent.update !== node;
            case "SequenceExpression": {
                const grandparent = this.#printer.parent(1);
                return !(
                    grandparent?.type === "ForStatement" &&
                    (grandparent.init === parent ||
                        grandparent.update === parent)
                );
            }
            default:
                return true;
        }
    }

    #inForInit(): boolean {
        let child = this.#printer.node;
        for (const ancestor of this.#printer.ancestors()) {
            if (ancestor.type === "ForStatement")
                return ancestor.init === child;
            if (
                ancestor.type.endsWith("Statement") ||
                Nodes.isFunction(ancestor)
            )
                return false;
            child = ancestor;
        }
        return false;
    }

    #optionalChain(node: Node): boolean {
        let current: Node = node;
        for (;;) {
            if (
                (current.type === "CallExpression" ||
                    current.type === "MemberExpression") &&
                current.optional
            )
                return true;
            if (current.type === "CallExpression") current = current.callee;
            else if (current.type === "MemberExpression")
                current = current.object;
            else if (current.type === "TSNonNullExpression")
                current = current.expression;
            else return false;
        }
    }

    /**
     * TypeScript reads `a<T> + b` as `a < T > +b` and rejects `a<T> >> b`,
     * also when `a<T>` only ends the left operand, like `(c + a<T>) - b`.
     */
    #beforeTypeArgumentOperator(node: Node): boolean {
        let child = node;
        for (const ancestor of this.#printer.ancestors()) {
            if (ancestor.type === "BinaryExpression") {
                if (ancestor.right === child) {
                    child = ancestor;
                    continue;
                }
                return (
                    ancestor.left === child &&
                    ["+", "-", "<", ">", ">=", ">>", ">>>"].includes(
                        ancestor.operator,
                    )
                );
            }
            if (
                ancestor.type !== "UnaryExpression" &&
                ancestor.type !== "TSTypeAssertion"
            )
                return false;
            child = ancestor;
        }
        return false;
    }

    #hasCall(node: Node): boolean {
        let current: Node = node;
        for (;;) {
            switch (current.type) {
                case "CallExpression":
                case "ImportExpression":
                    return true;
                case "MemberExpression":
                    current = current.object;
                    break;
                case "TaggedTemplateExpression":
                    current = current.tag;
                    break;
                case "TSNonNullExpression":
                    current = current.expression;
                    break;
                default:
                    return false;
            }
        }
    }
}
