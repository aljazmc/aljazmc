import type { Node, NodeOf } from "@aljazmc/syntax";
import {
    breakParent,
    conditionalGroup,
    type Doc,
    group,
    hardline,
    ifBreak,
    indent,
    join,
    label,
    line,
    softline,
    willBreak,
} from "../doc.js";
import Nodes from "./nodes.js";
import Section from "./section.js";

/** Thrown when a hugged last argument cannot be printed expanded. */
export class ArgumentExpansionBailout extends Error {}

type Call = NodeOf<"CallExpression" | "ImportExpression" | "NewExpression">;

interface Printed {
    node: Node;
    printed: Doc;
    needsParens?: boolean;
}

/** Calls, arguments, member access and member chains. */
export default class Calls extends Section {
    override register(): void {
        const p = this.printer;
        p.handle(["CallExpression", "NewExpression"], (node) =>
            this.#call(node),
        );
        p.handle(["ImportExpression"], (node) =>
            group([
                "import",
                node.phase ? `.${node.phase}` : "",
                this.arguments(node),
            ]),
        );
        p.handle(["MemberExpression"], (node) => this.#member(node));
    }

    #call(node: NodeOf<"CallExpression" | "NewExpression">): Doc {
        const isNew = node.type === "NewExpression";
        const args = node.arguments;
        const optional =
            node.type === "CallExpression" && node.optional ? "?." : "";
        const parent = this.printer.parent();

        if (
            (args.length === 1 &&
                Nodes.isTemplateOnItsOwnLine(
                    args[0] as Node,
                    this.printer.source,
                )) ||
            (args.length > 0 &&
                !isNew &&
                (this.#moduleDefinition(node) ||
                    Nodes.isTestCall(node, parent)))
        ) {
            return [
                isNew ? "new " : "",
                this.print(node.callee),
                optional,
                this.print(node.typeArguments),
                "(",
                join(
                    ", ",
                    args.map((arg) => this.print(arg)),
                ),
                ")",
            ];
        }

        if (
            !isNew &&
            Nodes.isMemberish(node.callee) &&
            !this.printer.within(node.callee, () =>
                this.printer.needsParentheses(node.callee),
            )
        ) {
            return this.#memberChain(node);
        }

        const contents: Doc = [
            isNew ? "new " : "",
            this.print(node.callee),
            optional,
            this.print(node.typeArguments),
            this.arguments(node),
        ];
        if (Nodes.isCall(node.callee)) return group(contents);
        return contents;
    }

    /** `require("x")`, `define([...], function () {})` keep their arguments together. */
    #moduleDefinition(node: NodeOf<"CallExpression">): boolean {
        const { callee, arguments: args } = node;
        if (callee.type !== "Identifier") return false;
        if (callee.name === "require")
            return (
                (args.length === 1 && Nodes.isString(args[0])) ||
                args.length > 1
            );
        if (
            callee.name === "define" &&
            this.printer.parent()?.type === "ExpressionStatement"
        ) {
            const [first, second] = args;
            return (
                args.length === 1 ||
                (args.length === 2 && first?.type === "ArrayExpression") ||
                (args.length >= 2 && second?.type === "FunctionExpression")
            );
        }
        return false;
    }

    // Arguments

    arguments(node: Call): Doc {
        const args =
            node.type === "ImportExpression"
                ? [node.source, ...(node.options ? [node.options] : [])]
                : node.arguments;
        const dynamicImport = node.type === "ImportExpression";

        if (args.length === 0) {
            if (
                node.type === "NewExpression" &&
                !node.parentheses &&
                !this.printer.hasDangling(node)
            )
                return "()";
            return ["(", this.printer.dangling(node), ")"];
        }

        if (this.#hookWithDependencies(args))
            return ["(", this.print(args[0]), ", ", this.print(args[1]), ")"];

        let anyEmptyLine = false;
        const last = args.length - 1;
        const printed: Doc[] = args.map((arg, index) => {
            const parts: Doc[] = [this.print(arg)];
            if (index === last) return parts;
            if (this.printer.isNextLineEmpty(arg.end)) {
                anyEmptyLine = true;
                parts.push(",", hardline, hardline);
            } else parts.push(",", line);
            return parts;
        });

        const trailingComma =
            !dynamicImport && this.options.trailingCommas === "all" ? "," : "";
        const allBrokenOut = () =>
            group(["(", indent([line, ...printed, trailingComma]), line, ")"], {
                shouldBreak: true,
            });

        if (
            anyEmptyLine ||
            (this.printer.parent()?.type !== "Decorator" &&
                this.#functionComposition(args))
        )
            return allBrokenOut();

        const groupFirst = this.#shouldGroupFirst(args);
        const groupLast = this.#shouldGroupLast(args);

        if (groupFirst || groupLast) {
            if (
                groupFirst
                    ? printed.slice(1).some(willBreak)
                    : printed.slice(0, -1).some(willBreak)
            )
                return allBrokenOut();

            let expanded: Doc[];
            try {
                if (groupFirst) {
                    const first = this.printer.print(args[0], {
                        expandFirstArg: true,
                    });
                    expanded = [first, ...printed.slice(1)];
                } else {
                    expanded = [
                        ...printed.slice(0, -1),
                        this.printer.print(args[last], { expandLastArg: true }),
                    ];
                }
            } catch (error) {
                if (error instanceof ArgumentExpansionBailout)
                    return allBrokenOut();
                throw error;
            }

            const states: Doc[] = groupFirst
                ? [
                      [
                          "(",
                          expanded[0] as Doc,
                          ", ",
                          ...expanded.slice(1),
                          ")",
                      ],
                      [
                          "(",
                          Calls.#expand(expanded[0] as Doc),
                          ", ",
                          ...expanded.slice(1),
                          ")",
                      ],
                      allBrokenOut(),
                  ]
                : [
                      ["(", ...expanded, ")"],
                      [
                          "(",
                          ...printed.slice(0, -1),
                          Calls.#expand(expanded.at(-1) as Doc),
                          ")",
                      ],
                      allBrokenOut(),
                  ];

            return [
                printed.some(willBreak) ? breakParent : "",
                conditionalGroup(states),
            ];
        }

        const contents: Doc = [
            "(",
            indent([softline, ...printed]),
            ifBreak(trailingComma),
            softline,
            ")",
        ];
        if (this.#longCurriedChain(node)) return contents;
        return group(contents, {
            shouldBreak: printed.some(willBreak) || anyEmptyLine,
        });
    }

    /** Expands a hugged argument's own group, like Biome, rather than wrapping it. */
    static #expand(doc: Doc): Doc {
        if (
            typeof doc === "object" &&
            !Array.isArray(doc) &&
            doc.type === "group" &&
            !doc.expandedStates
        )
            return { ...doc, break: true };
        return group(doc, { shouldBreak: true });
    }

    #hookWithDependencies(args: Node[]): boolean {
        const [first, second] = args;
        return (
            args.length === 2 &&
            first?.type === "ArrowFunctionExpression" &&
            first.params.length === 0 &&
            first.body.type === "BlockStatement" &&
            second?.type === "ArrayExpression" &&
            !args.some((arg) => this.printer.hasComment(arg))
        );
    }

    #functionComposition(args: Node[]): boolean {
        if (args.length <= 1) return false;
        let count = 0;
        for (const arg of args) {
            if (Nodes.isFunction(arg)) {
                count++;
                if (count > 1) return true;
            } else if (Nodes.isCall(arg) && arg.type !== "ImportExpression") {
                if (arg.arguments.some((child) => Nodes.isFunction(child)))
                    return true;
            }
        }
        return false;
    }

    /** `a(b)(c, d)` keeps inner arguments ungrouped when they are longer than the outer ones. */
    #longCurriedChain(node: Call): boolean {
        const parent = this.printer.parent();
        return (
            node.type === "CallExpression" &&
            parent?.type === "CallExpression" &&
            parent.callee === node &&
            parent.arguments.length > 0 &&
            node.arguments.length > parent.arguments.length
        );
    }

    #shouldGroupFirst(args: Node[]): boolean {
        if (args.length !== 2) return false;
        const [first, second] = args as [Node, Node];
        return (
            !this.printer.hasComment(first) &&
            (first.type === "FunctionExpression" ||
                (first.type === "ArrowFunctionExpression" &&
                    first.body.type === "BlockStatement")) &&
            second.type !== "FunctionExpression" &&
            second.type !== "ArrowFunctionExpression" &&
            second.type !== "ConditionalExpression" &&
            this.#hopefullyShort(second) &&
            !this.couldExpand(second)
        );
    }

    #hopefullyShort(node: Node): boolean {
        if (
            node.type === "TSAsExpression" ||
            node.type === "TSSatisfiesExpression"
        )
            return this.#hopefullyShort(node.expression);
        if (Nodes.isBinaryish(node))
            return (
                this.#hopefullyShort(node.left) &&
                this.#hopefullyShort(node.right)
            );
        if (node.type === "RegExpLiteral") return true;
        return (
            Nodes.isSimpleCallArgument(node) ||
            (Nodes.isCall(node) &&
                node.type !== "ImportExpression" &&
                node.arguments.length === 0)
        );
    }

    #shouldGroupLast(args: Node[]): boolean {
        const last = args.at(-1) as Node;
        const penultimate = args.at(-2);
        return (
            !this.printer.hasLeadingComment(last) &&
            !this.printer.hasTrailingComment(last) &&
            this.couldExpand(last) &&
            (!penultimate || penultimate.type !== last.type) &&
            (args.length !== 2 ||
                penultimate?.type !== "ArrowFunctionExpression" ||
                last.type !== "ArrayExpression") &&
            !(
                args.length > 1 &&
                last.type === "ArrayExpression" &&
                this.#conciseArray(last)
            )
        );
    }

    #conciseArray(node: NodeOf<"ArrayExpression">): boolean {
        return (
            node.elements.length > 1 &&
            node.elements.every(
                (element) =>
                    element?.type === "NumericLiteral" ||
                    (element?.type === "UnaryExpression" &&
                        element.argument.type === "NumericLiteral"),
            )
        );
    }

    couldExpand(arg: Node, arrowChainRecursion = false): boolean {
        switch (arg.type) {
            case "ObjectExpression":
                return (
                    arg.properties.length > 0 || this.printer.hasComment(arg)
                );
            case "ArrayExpression":
                return arg.elements.length > 0 || this.printer.hasComment(arg);
            case "TSTypeAssertion":
            case "TSAsExpression":
                return this.couldExpand(arg.expression);
            case "FunctionExpression":
                return true;
            case "ArrowFunctionExpression": {
                const { body, returnType } = arg;
                if (
                    returnType &&
                    returnType.type === "TSTypeReference" &&
                    !(
                        body.type === "BlockStatement" &&
                        (body.body.length > 0 || this.printer.hasComment(body))
                    )
                )
                    return false;
                return (
                    body.type === "BlockStatement" ||
                    (body.type === "ArrowFunctionExpression" &&
                        this.couldExpand(body, true)) ||
                    body.type === "ObjectExpression" ||
                    body.type === "ArrayExpression" ||
                    body.type === "TSAsExpression" ||
                    body.type === "TSSatisfiesExpression" ||
                    (!arrowChainRecursion &&
                        (body.type === "CallExpression" ||
                            body.type === "ConditionalExpression")) ||
                    Nodes.isJsx(body)
                );
            }
            default:
                return false;
        }
    }

    // Members

    #member(node: NodeOf<"MemberExpression">): Doc {
        const parent = this.printer.parent();
        // the member chain this member belongs to, and the node using it
        let chain: Node = node;
        const user = this.printer.ancestors().find((ancestor) => {
            if (
                Nodes.isMember(ancestor) ||
                ancestor.type === "TSNonNullExpression"
            ) {
                chain = ancestor;
                return false;
            }
            return true;
        });
        const object = this.print(node.object);
        const lookup = this.lookup(node);
        const shouldInline =
            this.#attached(node, object) ||
            (user?.type === "NewExpression" && user.callee === chain) ||
            (user?.type === "AssignmentExpression" &&
                user.left.type !== "Identifier") ||
            node.computed ||
            (node.object.type === "Identifier" &&
                node.property.type === "Identifier" &&
                !Nodes.isMember(parent));

        const isChain =
            typeof object === "object" &&
            !Array.isArray(object) &&
            object.type === "label" &&
            object.label === "member-chain";
        const doc: Doc = [
            object,
            shouldInline ? lookup : group(indent([softline, lookup])),
        ];
        return isChain ? label("member-chain", doc) : doc;
    }

    /** In assignments, members of calls with arguments and of member chains stay attached, like Biome. */
    #attached(node: NodeOf<"MemberExpression">, object: Doc): boolean {
        const parent = this.printer.parent();
        const assigned =
            (parent?.type === "AssignmentExpression" &&
                parent.right === node) ||
            (parent?.type === "VariableDeclarator" && parent.init === node) ||
            (parent?.type === "PropertyDefinition" && parent.value === node);
        if (!assigned) return false;
        const target =
            node.object.type === "TSNonNullExpression"
                ? node.object.expression
                : node.object;
        if (
            (target.type === "CallExpression" ||
                target.type === "NewExpression") &&
            target.arguments.length > 0
        )
            return true;
        return (
            typeof object === "object" &&
            !Array.isArray(object) &&
            object.type === "label" &&
            object.label === "member-chain"
        );
    }

    lookup(node: NodeOf<"MemberExpression">): Doc {
        const optional = node.optional ? "?." : "";
        const property = this.print(node.property);
        if (!node.computed) return [optional || ".", property];
        if (node.property.type === "NumericLiteral")
            return [optional, "[", property, "]"];
        return group([
            optional,
            "[",
            indent([softline, property]),
            softline,
            "]",
        ]);
    }

    // Member chains

    /** Prints `a.b().c().d()` on one line or one call per line, after Prettier's printMemberChain. */
    #memberChain(root: NodeOf<"CallExpression">): Doc {
        const parent = this.printer.parent();
        const isExpressionStatement =
            !parent || parent.type === "ExpressionStatement";
        const printedNodes: Printed[] = [];

        const emptyLineAfter = (node: Node): boolean => {
            const next = this.#nextCharacterIndex(node.end);
            if (this.printer.source[next] === ")")
                return this.printer.isNextLineEmpty(next + 1);
            return this.printer.isNextLineEmpty(node.end);
        };

        const callParts = (node: NodeOf<"CallExpression">): Doc => [
            node.optional ? "?." : "",
            this.print(node.typeArguments),
            this.arguments(node),
        ];

        const collect = (node: Node): void => {
            if (
                node.type === "CallExpression" &&
                (Nodes.isMemberish(node.callee) || Nodes.isCall(node.callee))
            ) {
                printedNodes.unshift({
                    node,
                    printed: [
                        this.printer.withComments(node, callParts(node)),
                        emptyLineAfter(node) ? hardline : "",
                    ],
                });
                this.printer.within(node.callee, () => collect(node.callee));
            } else if (Nodes.isMember(node)) {
                printedNodes.unshift({
                    node,
                    needsParens: this.printer.needsParentheses(node),
                    printed: this.printer.withComments(node, this.lookup(node)),
                });
                this.printer.within(node.object, () => collect(node.object));
            } else if (node.type === "TSNonNullExpression") {
                printedNodes.unshift({
                    node,
                    printed: this.printer.withComments(node, "!"),
                });
                this.printer.within(node.expression, () =>
                    collect(node.expression),
                );
            } else {
                printedNodes.unshift({
                    node,
                    printed: this.printer.printCurrent(),
                });
            }
        };

        printedNodes.unshift({ node: root, printed: callParts(root) });
        this.printer.within(root.callee, () => collect(root.callee));

        const groups = Calls.#groups(printedNodes);
        const shouldMerge = this.#shouldMerge(groups, isExpressionStatement);

        const printGroup = (printedGroup: Printed[]): Doc => {
            const docs = printedGroup.map((entry) => entry.printed);
            return printedGroup.at(-1)?.needsParens
                ? ["(", ...docs, ")"]
                : docs;
        };
        const printIndented = (rest: Printed[][]): Doc =>
            rest.length === 0
                ? ""
                : indent(
                      group([hardline, join(hardline, rest.map(printGroup))]),
                  );

        const printedGroups = groups.map(printGroup);
        const oneLine: Doc = printedGroups;
        const cutoff = shouldMerge ? 3 : 2;
        const flat = groups.flat();
        const hasComment =
            flat
                .slice(1, -1)
                .some((entry) => this.printer.hasLeadingComment(entry.node)) ||
            flat
                .slice(0, -1)
                .some((entry) => this.printer.hasTrailingComment(entry.node)) ||
            (groups[cutoff] !== undefined &&
                this.printer.hasLeadingComment(groups[cutoff]?.[0]?.node));

        if (
            groups.length <= cutoff &&
            !hasComment &&
            !printedGroups.slice(cutoff).some(willBreak)
        )
            return group(oneLine);

        const expanded: Doc = [
            printGroup(groups[0] as Printed[]),
            shouldMerge ? printGroup(groups[1] as Printed[]) : "",
            printIndented(groups.slice(shouldMerge ? 2 : 1)),
        ];
        const calls = printedNodes
            .map((entry) => entry.node)
            .filter(
                (node): node is NodeOf<"CallExpression"> =>
                    node.type === "CallExpression",
            );

        const lastGroupBreaks = () => {
            const lastNode = (groups.at(-1) as Printed[])[0]?.node;
            return (
                Nodes.isCall(lastNode) &&
                willBreak(printedGroups.at(-1) as Doc) &&
                calls
                    .slice(0, -1)
                    .some((call) =>
                        call.arguments.some((arg) => Nodes.isFunction(arg)),
                    )
            );
        };

        let result: Doc;
        if (
            hasComment ||
            (calls.length > 2 &&
                calls.some(
                    (call) =>
                        !call.arguments.every((arg) =>
                            Nodes.isSimpleCallArgument(arg),
                        ),
                )) ||
            printedGroups.slice(0, -1).some(willBreak) ||
            lastGroupBreaks()
        ) {
            result = group(expanded);
        } else {
            result = [
                willBreak(oneLine) ? breakParent : "",
                conditionalGroup([oneLine, expanded]),
            ];
        }
        return label("member-chain", result);
    }

    #nextCharacterIndex(index: number): number {
        let position = index;
        const source = this.printer.source;
        for (;;) {
            const rest = source.slice(position);
            const match = /^(?:\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/)/.exec(rest);
            if (!match || match[0].length === 0) return position;
            position += match[0].length;
        }
    }

    /** The nodes of a member chain, from its head to the outermost call. */
    static #chainNodes(root: NodeOf<"CallExpression">): Node[] {
        const nodes: Node[] = [root];
        let node: Node = root.callee;
        for (;;) {
            nodes.unshift(node);
            if (
                node.type === "CallExpression" &&
                (Nodes.isMemberish(node.callee) || Nodes.isCall(node.callee))
            )
                node = node.callee;
            else if (Nodes.isMember(node)) node = node.object;
            else if (node.type === "TSNonNullExpression")
                node = node.expression;
            else return nodes;
        }
    }

    /** Groups chain nodes: the head with its calls, then each `.member` with its calls. */
    static #groups<T extends { node: Node }>(entries: T[]): T[][] {
        const groups: T[][] = [];
        let current: T[] = [entries[0] as T];
        let index = 1;
        for (; index < entries.length; index++) {
            const { node } = entries[index] as T;
            if (
                node.type === "TSNonNullExpression" ||
                Nodes.isCall(node) ||
                (Nodes.isMember(node) &&
                    node.computed &&
                    Nodes.isLiteral(node.property))
            )
                current.push(entries[index] as T);
            else break;
        }
        if (!Nodes.isCall((entries[0] as T).node)) {
            for (; index + 1 < entries.length; index++) {
                if (
                    Nodes.isMemberish((entries[index] as T).node) &&
                    Nodes.isMemberish((entries[index + 1] as T).node)
                )
                    current.push(entries[index] as T);
                else break;
            }
        }
        groups.push(current);
        current = [];

        let seenCall = false;
        for (; index < entries.length; index++) {
            const entry = entries[index] as T;
            if (seenCall && Nodes.isMemberish(entry.node)) {
                if (
                    Nodes.isMember(entry.node) &&
                    entry.node.computed &&
                    !Nodes.isLiteral(entry.node.property)
                ) {
                    current.push(entry);
                    continue;
                }
                groups.push(current);
                current = [];
                seenCall = false;
            }
            if (Nodes.isCall(entry.node)) seenCall = true;
            current.push(entry);
            if (
                entry.node.comments?.some(
                    (comment) => comment.placement === "trailing",
                )
            ) {
                groups.push(current);
                current = [];
                seenCall = false;
            }
        }
        if (current.length > 0) groups.push(current);
        return groups;
    }

    /** Short heads like `this`, `$` or `Factory` stay on the line of the first call. */
    #shouldMerge<T extends { node: Node }>(
        groups: T[][],
        isExpressionStatement: boolean,
    ): boolean {
        if (groups.length < 2 || (groups[1] as T[]).length === 0) return false;
        const isFactory = (name: string) => /^[A-Z]|^[$_]+$/.test(name);
        const first = groups[1]?.[0]?.node;
        const hasComputed =
            first !== undefined &&
            Nodes.isMember(first) &&
            first.computed &&
            Nodes.isLiteral(first.property);
        const head = groups[0] as T[];
        if (head.length === 1) {
            const node = (head[0] as T).node;
            return (
                node.type === "ThisExpression" ||
                (node.type === "Identifier" &&
                    (isFactory(node.name) ||
                        (isExpressionStatement &&
                            node.name.length <= this.options.indentWidth) ||
                        hasComputed))
            );
        }
        const last = (head.at(-1) as T).node;
        return (
            Nodes.isMember(last) &&
            last.property.type === "Identifier" &&
            (isFactory(last.property.name) || hasComputed)
        );
    }

    /** Whether a call chain has more groups than fit one line by rule, so it may break per call. */
    isLongChain(root: Node, isExpressionStatement = false): boolean {
        if (root.type !== "CallExpression" || !Nodes.isMemberish(root.callee))
            return false;
        const groups = Calls.#groups(
            Calls.#chainNodes(root).map((node) => ({ node })),
        );
        return (
            groups.length >
            (this.#shouldMerge(groups, isExpressionStatement) ? 3 : 2)
        );
    }
}
