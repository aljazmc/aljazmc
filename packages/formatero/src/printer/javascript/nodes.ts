import type { Node, NodeOf } from "@aljazmc/syntax";

/** Predicates and facts about syntax nodes shared by the printers. */
// biome-ignore lint/complexity/noStaticOnlyClass: a namespace of node predicates shared by all printer sections
export default class Nodes {
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
        in: 8,
        instanceof: 8,
        ">>": 9,
        "<<": 9,
        ">>>": 9,
        "+": 10,
        "-": 10,
        "*": 11,
        "/": 11,
        "%": 11,
        "**": 12,
    };

    static precedence(operator: string): number {
        return Nodes.#precedence[operator] ?? 0;
    }

    /** Whether `a op1 b op2 c` can print without parentheses as one chain. */
    static shouldFlatten(parent: string, child: string): boolean {
        if (Nodes.precedence(child) !== Nodes.precedence(parent)) return false;
        if (parent === "**") return false;
        if (Nodes.isEquality(parent) && Nodes.isEquality(child)) return false;
        if (
            (child === "%" && Nodes.isMultiplicative(parent)) ||
            (parent === "%" && Nodes.isMultiplicative(child))
        )
            return false;
        if (
            child !== parent &&
            Nodes.isMultiplicative(child) &&
            Nodes.isMultiplicative(parent)
        )
            return false;
        if (Nodes.isBitshift(parent) && Nodes.isBitshift(child)) return false;
        return true;
    }

    /** `a && {...}` and `a || [...]` keep the right side on the operator line. */
    static shouldInlineLogical(node: Node): boolean {
        if (node.type !== "LogicalExpression") return false;
        const { right } = node;
        if (right.type === "ObjectExpression" && right.properties.length > 0)
            return true;
        if (right.type === "ArrayExpression" && right.elements.length > 0)
            return true;
        return Nodes.isJsx(right);
    }

    static isEquality(operator: string): boolean {
        return ["==", "!=", "===", "!=="].includes(operator);
    }

    static isMultiplicative(operator: string): boolean {
        return ["*", "/", "%"].includes(operator);
    }

    static isBitshift(operator: string): boolean {
        return [">>", ">>>", "<<"].includes(operator);
    }

    static isBitwise(operator: string): boolean {
        return Nodes.isBitshift(operator) || ["|", "^", "&"].includes(operator);
    }

    static isBinaryish(
        node?: Node | null,
    ): node is NodeOf<"BinaryExpression" | "LogicalExpression"> {
        return (
            node?.type === "BinaryExpression" ||
            node?.type === "LogicalExpression"
        );
    }

    static isCall(
        node?: Node | null,
    ): node is NodeOf<"CallExpression" | "NewExpression" | "ImportExpression"> {
        return (
            node?.type === "CallExpression" ||
            node?.type === "NewExpression" ||
            node?.type === "ImportExpression"
        );
    }

    static isMember(node?: Node | null): node is NodeOf<"MemberExpression"> {
        return node?.type === "MemberExpression";
    }

    static isMemberish(node?: Node | null): boolean {
        return (
            node?.type === "MemberExpression" ||
            node?.type === "TSNonNullExpression"
        );
    }

    static isFunction(
        node?: Node | null,
    ): node is NodeOf<"ArrowFunctionExpression" | "FunctionExpression"> {
        return (
            node?.type === "FunctionExpression" ||
            node?.type === "ArrowFunctionExpression"
        );
    }

    static isString(node?: Node | null): node is NodeOf<"StringLiteral"> {
        return node?.type === "StringLiteral";
    }

    static isObjectOrRecord(node?: Node | null): boolean {
        return (
            node?.type === "ObjectExpression" || node?.type === "ObjectPattern"
        );
    }

    static isArray(node?: Node | null): boolean {
        return (
            node?.type === "ArrayExpression" || node?.type === "ArrayPattern"
        );
    }

    static isLiteral(node?: Node | null): boolean {
        return [
            "BooleanLiteral",
            "NullLiteral",
            "NumericLiteral",
            "RegExpLiteral",
            "StringLiteral",
        ].includes(node?.type ?? "");
    }

    static isJsx(node?: Node | null): node is NodeOf<"JSXElement"> {
        return node?.type === "JSXElement";
    }

    /** A multiline template starting on the line of the code before it, after Prettier. */
    static isTemplateOnItsOwnLine(node: Node, source: string): boolean {
        const multiline =
            (node.type === "TemplateLiteral" &&
                Nodes.templateHasNewline(node)) ||
            (node.type === "TaggedTemplateExpression" &&
                Nodes.templateHasNewline(node.quasi));
        return (
            multiline &&
            !/(?:^|[\r\n])[ \t]*$/.test(source.slice(0, node.start))
        );
    }

    static templateHasNewline(node: NodeOf<"TemplateLiteral">): boolean {
        return node.quasis.some((quasi) => quasi.raw.includes("\n"));
    }

    /** `a.b.c` without calls. */
    static isMemberChain(node: Node): boolean {
        if (!Nodes.isMember(node)) return false;
        if (node.object.type === "Identifier") return true;
        return Nodes.isMemberChain(node.object);
    }

    static isSimpleTemplate(node: Node): boolean {
        if (node.type !== "TemplateLiteral") return false;
        return node.expressions.every((expression) => {
            if (expression.comments?.length) return false;
            if (
                expression.type === "Identifier" ||
                expression.type === "ThisExpression"
            )
                return true;
            if (Nodes.isMember(expression)) {
                let head: Node = expression;
                while (Nodes.isMember(head)) {
                    if (
                        head.property.type !== "Identifier" &&
                        head.property.type !== "NumericLiteral" &&
                        head.property.type !== "StringLiteral"
                    )
                        return false;
                    if (head.computed && head.property.type === "Identifier")
                        return false;
                    head = head.object;
                    if (head.comments?.length) return false;
                }
                return (
                    head.type === "Identifier" || head.type === "ThisExpression"
                );
            }
            return false;
        });
    }

    /** Arguments that keep a member chain on one line, after Biome's SimpleArgument. */
    static isSimpleCallArgument(node: Node, depth = 0): boolean {
        if (depth >= 2) return false;
        const simple = (child: Node, level = depth) =>
            Nodes.isSimpleCallArgument(child, level);

        switch (node.type) {
            case "BooleanLiteral":
            case "NullLiteral":
            case "NumericLiteral":
            case "StringLiteral":
            case "Identifier":
            case "ThisExpression":
            case "Super":
            case "PrivateName":
            case "MetaProperty":
                return true;
            case "RegExpLiteral":
                return node.raw.lastIndexOf("/") - 1 <= 5;
            case "TemplateLiteral":
                return (
                    node.quasis.every((quasi) => !quasi.raw.includes("\n")) &&
                    node.expressions.every((expression) => simple(expression))
                );
            case "ObjectExpression":
                return node.properties.every(
                    (property) =>
                        property.type === "Property" &&
                        !property.computed &&
                        (property.shorthand ||
                            simple(property.value, depth + 1)),
                );
            case "ArrayExpression":
                return node.elements.every(
                    (element) => element === null || simple(element, depth + 1),
                );
            case "UnaryExpression":
                return (
                    ["!", "-", "+", "~"].includes(node.operator) &&
                    simple(node.argument)
                );
            case "TSNonNullExpression":
                return simple(node.expression);
            case "MemberExpression":
                return (
                    simple(node.object) &&
                    (!node.computed || simple(node.property))
                );
            case "ImportExpression":
                return simple(node.source, depth + 1);
            case "CallExpression":
            case "NewExpression":
                return (
                    simple(node.callee) &&
                    node.arguments.every((arg) => simple(arg, depth + 1))
                );
            default:
                return false;
        }
    }

    /** `describe("name", () => {})` and similar test calls keep their arguments hugged. */
    static isTestCall(node: Node, parent?: Node): boolean {
        if (node.type !== "CallExpression" || node.optional) return false;
        const args = node.arguments;

        if (args.length === 1) {
            const [only] = args as [Node];
            if (
                Nodes.isAngularTestWrapper(node) &&
                parent &&
                Nodes.isTestCall(parent)
            )
                return Nodes.isFunction(only);
            if (
                node.callee.type === "Identifier" &&
                /^(?:before|after)(?:Each|All)$/.test(node.callee.name)
            )
                return Nodes.isAngularTestWrapper(only);
            return false;
        }

        if (
            (args.length === 2 || args.length === 3) &&
            Nodes.isUnitTestCallee(node.callee)
        ) {
            const [name, fn, timeout] = args as [Node, Node, Node | undefined];
            if (
                name.type !== "StringLiteral" &&
                name.type !== "TemplateLiteral"
            )
                return false;
            if (timeout && timeout.type !== "NumericLiteral") return false;
            if (Nodes.isFunction(fn))
                return (
                    (args.length === 2 || fn.body?.type === "BlockStatement") &&
                    fn.params.length <= 1
                );
            return Nodes.isAngularTestWrapper(fn);
        }
        return false;
    }

    static calleeName(callee: Node): string | null {
        if (callee.type === "Identifier") return callee.name;
        return null;
    }

    static #testCallees = [
        "it",
        "it.only",
        "it.skip",
        "describe",
        "describe.only",
        "describe.skip",
        "test",
        "test.only",
        "test.skip",
        "test.step",
        "test.describe",
        "test.describe.only",
        "test.describe.parallel",
        "test.describe.parallel.only",
        "test.describe.serial",
        "test.describe.serial.only",
        "skip",
        "xit",
        "xdescribe",
        "xtest",
        "fit",
        "fdescribe",
        "ftest",
    ];

    static isUnitTestCallee(callee: Node): boolean {
        const name = Nodes.dotted(callee);
        return name !== null && Nodes.#testCallees.includes(name);
    }

    static dotted(node: Node): string | null {
        if (node.type === "Identifier") return node.name;
        if (
            Nodes.isMember(node) &&
            !node.computed &&
            node.property.type === "Identifier"
        ) {
            const object = Nodes.dotted(node.object);
            return object === null ? null : `${object}.${node.property.name}`;
        }
        return null;
    }

    static isAngularTestWrapper(node: Node): boolean {
        return (
            node.type === "CallExpression" &&
            node.callee.type === "Identifier" &&
            ["async", "inject", "fakeAsync", "waitForAsync"].includes(
                node.callee.name,
            )
        );
    }

    /** The leftmost node of an expression, which decides statement-start ambiguities. */
    static leftmost(node: Node): Node {
        let current = node;
        for (;;) {
            if (current.parenthesized) return current;
            switch (current.type) {
                case "BinaryExpression":
                case "LogicalExpression":
                case "AssignmentExpression":
                    current = current.left;
                    break;
                case "MemberExpression":
                    current = current.object;
                    break;
                case "CallExpression":
                case "NewExpression":
                    if (current.type === "NewExpression") return current;
                    current = current.callee;
                    break;
                case "TaggedTemplateExpression":
                    current = current.tag;
                    break;
                case "ConditionalExpression":
                    current = current.test;
                    break;
                case "UpdateExpression":
                    if (current.prefix) return current;
                    current = current.argument;
                    break;
                case "SequenceExpression":
                    current = current.expressions[0] as Node;
                    break;
                case "TSAsExpression":
                case "TSSatisfiesExpression":
                case "TSNonNullExpression":
                    current = current.expression;
                    break;
                default:
                    return current;
            }
        }
    }
}
