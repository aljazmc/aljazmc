import type { Node, NodeOf } from "@aljazmc/syntax";
import {
    align,
    breakParent,
    type Doc,
    dedent,
    fill,
    group,
    hardline,
    ifBreak,
    indent,
    indentIfBreak,
    join,
    line,
    lineSuffixBoundary,
    removeLines,
    softline,
    willBreak,
} from "../doc.js";
import Assignments from "./assignments.js";
import Nodes from "./nodes.js";
import Section from "./section.js";

/** Literals, objects, arrays, operators, conditionals and templates. */
export default class Expressions extends Section {
    override register(): void {
        const p = this.printer;
        p.handle(["Identifier"], (node) => [
            node.name,
            this.#definite(node),
            node.optional ? "?" : "",
            this.typeAnnotation(node.typeAnnotation),
        ]);
        p.handle(["PrivateName"], (node) => `#${node.name}`);
        p.handle(["ThisExpression"], () => "this");
        p.handle(["Super"], () => "super");
        p.handle(["NullLiteral"], () => "null");
        p.handle(["BooleanLiteral"], (node) => String(node.value));
        p.handle(["NumericLiteral"], (node) =>
            this.options.json ? node.raw : Expressions.number(node.raw),
        );
        p.handle(["StringLiteral"], (node) => this.string(node.raw));
        p.handle(["RegExpLiteral"], (node) => this.#regex(node.raw));
        p.handle(["MetaProperty"], (node) => `${node.meta}.${node.property}`);
        p.handle(["TemplateLiteral"], (node) =>
            this.template(node.quasis, node.expressions),
        );
        p.handle(["TemplateElement"], (node) =>
            join(
                { type: "line", hard: true, literal: true },
                node.raw.split("\n"),
            ),
        );
        p.handle(["TaggedTemplateExpression"], (node) => [
            this.print(node.tag),
            this.print(node.typeArguments),
            lineSuffixBoundary,
            this.print(node.quasi),
        ]);
        p.handle(["ArrayExpression", "ArrayPattern"], (node) =>
            this.#array(node),
        );
        p.handle(["ObjectExpression", "ObjectPattern"], (node) =>
            this.object(node),
        );
        p.handle(["Property"], (node) => this.#property(node));
        p.handle(["SpreadElement", "RestElement"], (node) => [
            "...",
            this.print(node.argument),
            node.type === "RestElement"
                ? [
                      node.optional ? "?" : "",
                      this.typeAnnotation(node.typeAnnotation),
                  ]
                : "",
        ]);
        p.handle(["AssignmentPattern"], (node) => [
            this.print(node.left),
            " = ",
            this.print(node.right),
        ]);
        p.handle(["UnaryExpression"], (node) => this.#unary(node));
        p.handle(["UpdateExpression"], (node) =>
            node.prefix
                ? [node.operator, this.print(node.argument)]
                : [this.print(node.argument), node.operator],
        );
        p.handle(["AwaitExpression"], (node) => this.#await(node));
        p.handle(["YieldExpression"], (node) => [
            "yield",
            node.delegate ? "*" : "",
            node.argument ? [" ", this.print(node.argument)] : "",
        ]);
        p.handle(["SequenceExpression"], (node) => this.#sequence(node));
        p.handle(["ConditionalExpression"], (node) => this.ternary(node));
        p.handle(["BinaryExpression", "LogicalExpression"], (node) =>
            this.#binaryish(node),
        );
        p.handle(["TSAsExpression", "TSSatisfiesExpression"], (node) =>
            this.#cast(node),
        );
        p.handle(["TSNonNullExpression"], (node) => [
            this.print(node.expression),
            "!",
        ]);
        p.handle(["TSTypeAssertion"], (node) => [
            "<",
            this.print(node.typeAnnotation),
            ">",
            this.print(node.expression),
        ]);
        p.handle(["TSInstantiationExpression"], (node) => [
            this.print(node.expression),
            this.print(node.typeArguments),
        ]);
    }

    typeAnnotation(type: Node | null | undefined): Doc {
        return type ? [": ", this.print(type)] : "";
    }

    #definite(node: NodeOf<"Identifier">): string {
        const parent = this.printer.parent();
        return parent?.type === "VariableDeclarator" &&
            parent.id === node &&
            parent.definite
            ? "!"
            : "";
    }

    // Literals

    /** Normalizes a number like Prettier: lowercase, no redundant zeros or signs. */
    static number(raw: string): string {
        if (/^0[box]/i.test(raw)) return raw.toLowerCase();
        return raw
            .toLowerCase()
            .replace(/^([+-]?[\d._]+e)(?:\+|(-))?0*(\d)/, "$1$2$3")
            .replace(/^([+-]?[\d._]+)e[+-]?0+$/, "$1")
            .replace(/^([+-])?\./, "$10.")
            .replace(/(\.\d+?)0+(?=e|$)/, "$1")
            .replace(/\.(?=e|$)/, "");
    }

    /** Requotes a string with the preferred quote, unless that needs more escapes. */
    string(raw: string, quote: string = this.options.quote): string {
        if (this.options.json) return raw;
        const content = raw.slice(1, -1);
        const alternate = quote === '"' ? "'" : '"';
        const count = (char: string) => content.split(char).length - 1;
        const enclosing = count(quote) > count(alternate) ? alternate : quote;
        const other = enclosing === '"' ? "'" : '"';

        const body = content.replace(
            /\\([\s\S])|(["'])/g,
            (match, escaped: string | undefined, bare: string | undefined) => {
                if (escaped === other) return escaped;
                if (bare === enclosing) return `\\${bare}`;
                if (bare) return bare;
                return match;
            },
        );
        return enclosing + body + enclosing;
    }

    #regex(raw: string): string {
        const slash = raw.lastIndexOf("/");
        const flags = [...raw.slice(slash + 1)].sort().join("");
        return raw.slice(0, slash + 1) + flags;
    }

    /**
     * Template literals: an interpolation stays on one line, unless the source
     * broke it, then it may break at `${` and `}` like Biome does.
     */
    template(quasis: NodeOf<"TemplateElement">[], expressions: Node[]): Doc {
        const parts: Doc[] = [lineSuffixBoundary, "`"];
        const space = this.options.delimiterSpacing ? " " : "";

        for (const [index, quasi] of quasis.entries()) {
            parts.push(this.print(quasi));
            const expression = expressions[index];
            const next = quasis[index + 1];
            if (!expression || !next) continue;

            let printed: Doc = this.print(expression);
            // like Biome: on one line, unless the source broke it or it must break
            if (
                !this.printer.hasNewlineInRange(quasi.end, next.start) &&
                !willBreak(printed)
            )
                printed = removeLines(printed);
            else if (
                this.printer.hasComment(expression) ||
                Nodes.isMember(expression) ||
                expression.type === "ConditionalExpression" ||
                expression.type === "SequenceExpression" ||
                expression.type === "TSAsExpression" ||
                expression.type === "TSSatisfiesExpression" ||
                Nodes.isBinaryish(expression)
            )
                printed = [indent([softline, printed]), softline];

            const size = this.#indentSize(quasi.raw);
            parts.push(
                group([
                    "${",
                    space,
                    this.#alignTo(printed, size),
                    space,
                    lineSuffixBoundary,
                    "}",
                ]),
            );
        }

        parts.push("`");
        return parts;
    }

    /** Indentation of the last line of a template part, which interpolations align to. */
    #indentSize(raw: string): number {
        const newline = raw.lastIndexOf("\n");
        if (newline === -1) return 0;
        const indent = /^[\t ]*/.exec(raw.slice(newline + 1))?.[0] ?? "";
        return [...indent].reduce(
            (size, char) =>
                size + (char === "\t" ? this.options.indentWidth : 1),
            0,
        );
    }

    /** Aligns to an absolute column, like Prettier's addAlignmentToDoc. */
    #alignTo(doc: Doc, size: number): Doc {
        if (size <= 0) return doc;
        let aligned: Doc = doc;
        for (
            let level = 0;
            level < Math.floor(size / this.options.indentWidth);
            level++
        )
            aligned = indent(aligned);
        return align(
            Number.NEGATIVE_INFINITY,
            align(size % this.options.indentWidth, aligned),
        );
    }

    // Collections

    #array(node: NodeOf<"ArrayExpression" | "ArrayPattern">): Doc {
        const suffix: Doc =
            node.type === "ArrayPattern"
                ? [
                      node.optional ? "?" : "",
                      this.typeAnnotation(node.typeAnnotation),
                  ]
                : "";
        const { elements } = node;

        if (elements.length === 0) {
            if (!this.printer.hasDangling(node)) return ["[]", suffix];
            return [
                group(["[", this.printer.dangling(node), softline, "]"]),
                suffix,
            ];
        }

        const last = elements.at(-1);
        const canHaveTrailingComma = !(last && last.type === "RestElement");
        const forcedTrailingComma = last === null;
        const id = Symbol("array");
        const shouldBreak =
            (this.options.expand === "always" &&
                node.type === "ArrayExpression") ||
            (!this.options.json &&
                elements.length > 1 &&
                elements.every((element, index) => {
                    const next = elements[index + 1];
                    if (
                        !element ||
                        (element.type !== "ObjectExpression" &&
                            element.type !== "ArrayExpression")
                    )
                        return false;
                    if (next && next.type !== element.type) return false;
                    return (
                        (element.type === "ArrayExpression"
                            ? element.elements.length
                            : element.properties.length) > 1
                    );
                }));
        const concise = this.options.expand !== "always" && this.#concise(node);
        const comma = this.#comma("es5");
        const trailingComma = !canHaveTrailingComma
            ? ""
            : forcedTrailingComma
              ? ","
              : comma === ""
                ? ""
                : concise
                  ? ifBreak(",", "", id)
                  : ifBreak(",");

        const items = concise
            ? this.#conciseItems(node, trailingComma)
            : [this.#items(elements), trailingComma];
        const spacingOpen = this.options.delimiterSpacing ? line : softline;
        return [
            group(
                [
                    "[",
                    indent([spacingOpen, items, this.printer.dangling(node)]),
                    spacingOpen,
                    "]",
                ],
                { shouldBreak, id },
            ),
            suffix,
        ];
    }

    #items(elements: (Node | null)[]): Doc {
        const parts: Doc[] = [];
        for (const [index, element] of elements.entries()) {
            parts.push(element ? group(this.print(element)) : "");
            if (index < elements.length - 1)
                parts.push([
                    ",",
                    line,
                    element && this.printer.isNextLineEmpty(element.end)
                        ? softline
                        : "",
                ]);
        }
        return parts;
    }

    /** Arrays of numbers are filled, many per line. */
    #concise(node: NodeOf<"ArrayExpression" | "ArrayPattern">): boolean {
        return (
            node.elements.length > 1 &&
            node.elements.every(
                (element) =>
                    element &&
                    (element.type === "NumericLiteral" ||
                        (element.type === "UnaryExpression" &&
                            ["+", "-"].includes(element.operator) &&
                            element.argument.type === "NumericLiteral" &&
                            !this.printer.hasComment(element.argument))) &&
                    !this.printer.hasComment(
                        element,
                        (comment) =>
                            comment.placement === "trailing" &&
                            comment.type === "Line",
                    ),
            )
        );
    }

    #conciseItems(
        node: NodeOf<"ArrayExpression" | "ArrayPattern">,
        trailingComma: Doc,
    ): Doc {
        const parts: Doc[] = [];
        const { elements } = node;
        for (const [index, element] of elements.entries()) {
            const last = index === elements.length - 1;
            parts.push([this.print(element), last ? trailingComma : ","]);
            if (!last) {
                const next = elements[index + 1];
                parts.push(
                    element && this.printer.isNextLineEmpty(element.end)
                        ? [hardline, hardline]
                        : this.printer.hasComment(
                                next,
                                (comment) =>
                                    comment.placement === "leading" &&
                                    comment.type === "Line",
                            )
                          ? hardline
                          : line,
                );
            }
        }
        return fill(parts);
    }

    /** Whether the trailing comma style allows commas at this level ("es5" or "all"). */
    #comma(level: "all" | "es5"): string {
        if (this.options.json) return "";
        const style = this.options.trailingCommas;
        if (style === "none") return "";
        if (level === "all" && style !== "all") return "";
        return ",";
    }

    /** Objects, object patterns, type literals and interface bodies. */
    object(
        node: NodeOf<
            | "ObjectExpression"
            | "ObjectPattern"
            | "TSTypeLiteral"
            | "TSInterfaceBody"
        >,
    ): Doc {
        const members =
            node.type === "TSTypeLiteral"
                ? node.members
                : node.type === "TSInterfaceBody"
                  ? node.body
                  : node.properties;
        const typeLike =
            node.type === "TSTypeLiteral" || node.type === "TSInterfaceBody";
        const parent = this.printer.parent();
        const first = members[0];
        const suffix: Doc =
            node.type === "ObjectPattern"
                ? [
                      node.optional ? "?" : "",
                      this.typeAnnotation(node.typeAnnotation),
                  ]
                : "";

        const preserved =
            this.options.expand === "auto" &&
            first !== undefined &&
            this.printer.hasNewlineInRange(node.start, first.start);
        const shouldBreak =
            node.type === "TSInterfaceBody" ||
            (this.options.expand === "always" &&
                node.type !== "ObjectPattern" &&
                members.length > 0) ||
            (node.type === "ObjectPattern" &&
                parent?.type !== "FunctionDeclaration" &&
                parent?.type !== "FunctionExpression" &&
                parent?.type !== "ArrowFunctionExpression" &&
                parent?.type !== "AssignmentPattern" &&
                parent?.type !== "CatchClause" &&
                parent?.type !== "TSDeclareFunction" &&
                node.properties.some(
                    (property) =>
                        property.type === "Property" &&
                        property.value &&
                        (property.value.type === "ObjectPattern" ||
                            property.value.type === "ArrayPattern"),
                )) ||
            (node.type !== "ObjectPattern" &&
                preserved &&
                this.options.expand !== "never");

        const separator: Doc = typeLike ? ifBreak(this.printer.semi, ";") : ",";
        const parts: Doc[] = [];
        let separatorParts: Doc[] = [];
        for (const member of members) {
            parts.push(...separatorParts, group(this.print(member)));
            separatorParts = [separator, line];
            if (this.printer.isNextLineEmpty(member.end))
                separatorParts.push(hardline);
        }

        const last = members.at(-1);
        const canHaveTrailingSeparator = !(last && last.type === "RestElement");
        const spacing = this.options.bracketSpacing ? line : softline;

        if (parts.length === 0) {
            if (!this.printer.hasDangling(node)) return ["{}", suffix];
            return group([
                "{",
                this.printer.dangling(node, { indented: true }),
                softline,
                "}",
                suffix,
            ]);
        }

        const trailing =
            canHaveTrailingSeparator && (typeLike || this.#comma("es5") !== "")
                ? separator
                : "";
        const content: Doc = [
            "{",
            indent([spacing, ...parts]),
            ifBreak(trailing),
            this.printer.dangling(node, { indented: true }),
            spacing,
            "}",
            suffix,
        ];

        if (this.#hugged(node, parent, shouldBreak)) return content;
        return group(content, { shouldBreak });
    }

    /** Objects hugged by their parent, like the only destructured parameter, print without a group. */
    #hugged(
        node: Node,
        parent: Node | undefined,
        shouldBreak: boolean,
    ): boolean {
        if (!parent) return false;
        if (
            node.type === "ObjectPattern" &&
            Nodes.isFunction(parent) &&
            this.shouldHugTheOnlyParameter(parent)
        )
            return true;
        // assignments add the group themselves before breaking at `=`
        if (
            !shouldBreak &&
            node.type === "ObjectPattern" &&
            (parent.type === "AssignmentExpression" ||
                parent.type === "VariableDeclarator")
        )
            return true;
        if (node.type === "TSTypeLiteral" || node.type === "ObjectPattern") {
            const fn = this.printer.parent(1);
            if (
                (parent.type === "Identifier" ||
                    parent.type === "ObjectPattern") &&
                fn &&
                (Nodes.isFunction(fn) ||
                    fn.type === "FunctionDeclaration" ||
                    fn.type === "TSDeclareFunction" ||
                    fn.type === "TSMethodSignature") &&
                this.shouldHugTheOnlyParameter(fn)
            )
                return fn.params[0] === parent;
        }
        return false;
    }

    shouldHugTheOnlyParameter(fn: Node): boolean {
        const params = "params" in fn ? (fn.params as Node[]) : [];
        if (params.length !== 1) return false;
        const [param] = params as [Node];
        if (this.printer.hasComment(param)) return false;
        if (param.type === "ObjectPattern" || param.type === "ArrayPattern")
            return true;
        if (
            param.type === "Identifier" &&
            param.typeAnnotation &&
            Expressions.isObjectType(param.typeAnnotation)
        )
            return true;
        if (param.type === "AssignmentPattern") {
            const { left, right } = param;
            return (
                (left.type === "ObjectPattern" ||
                    left.type === "ArrayPattern") &&
                (right.type === "Identifier" ||
                    (right.type === "ObjectExpression" &&
                        right.properties.length === 0) ||
                    (right.type === "ArrayExpression" &&
                        right.elements.length === 0))
            );
        }
        return false;
    }

    static isObjectType(node: Node): boolean {
        return node.type === "TSTypeLiteral" || node.type === "TSMappedType";
    }

    #property(node: NodeOf<"Property">): Doc {
        if (node.shorthand) return this.print(node.value);
        const key = this.propertyKey(node);
        if (node.method || node.kind !== "init") {
            const value = node.value as NodeOf<"FunctionExpression">;
            const prefix =
                node.kind === "get" || node.kind === "set"
                    ? `${node.kind} `
                    : value.async
                      ? "async "
                      : "";
            return [prefix, value.generator ? "*" : "", key, this.print(value)];
        }
        return this.printer
            .section(Assignments)
            .printAssignment(node, key, ":", node.value);
    }

    /** Prints a property key, unquoting it when quotes are not needed. */
    propertyKey(node: { key: Node; computed: boolean }): Doc {
        const { key } = node;
        if (node.computed) return ["[", this.print(key), "]"];
        if (
            !this.options.json &&
            this.options.quoteProperties === "asNeeded" &&
            key.type === "StringLiteral" &&
            !this.printer.hasComment(key)
        ) {
            const content = key.raw.slice(1, -1);
            if (
                /^[$_\p{ID_Start}](?:[$\p{ID_Continue}]|\u200c|\u200d)*$/u.test(
                    content,
                )
            )
                return content;
            // JavaScript, unlike TypeScript, unquotes simple numbers: `{ "1": a }` is `{ 1: a }`
            if (
                !this.options.typescript &&
                /^(?:\d+|\d+\.\d+)$/.test(content) &&
                String(Number(content)) === content
            )
                return content;
        }
        return this.print(key);
    }

    // Operators

    #unary(node: NodeOf<"UnaryExpression">): Doc {
        const parts: Doc[] = [node.operator];
        if (/[a-z]$/.test(node.operator)) parts.push(" ");
        else if (this.options.delimiterSpacing && node.operator === "!")
            parts.push(" ");
        if (
            this.printer.hasComment(node.argument) &&
            !/[a-z]$/.test(node.operator)
        )
            parts.push(
                group([
                    "(",
                    indent([softline, this.print(node.argument)]),
                    softline,
                    ")",
                ]),
            );
        else parts.push(this.print(node.argument));
        return parts;
    }

    #await(node: NodeOf<"AwaitExpression">): Doc {
        const parts: Doc[] = ["await", " ", this.print(node.argument)];
        const parent = this.printer.parent();
        if (
            (parent?.type === "CallExpression" && parent.callee === node) ||
            (parent?.type === "MemberExpression" && parent.object === node)
        ) {
            const wrapped: Doc = [indent([softline, ...parts]), softline];
            const ancestor = this.printer
                .ancestors()
                .find(
                    (candidate) =>
                        candidate.type === "AwaitExpression" ||
                        candidate.type === "BlockStatement",
                );
            if (
                ancestor?.type !== "AwaitExpression" ||
                Nodes.leftmost(ancestor.argument) !== Nodes.leftmost(node)
            )
                return group(wrapped);
            return wrapped;
        }
        return parts;
    }

    #sequence(node: NodeOf<"SequenceExpression">): Doc {
        const parent = this.printer.parent();
        if (
            parent?.type === "ExpressionStatement" ||
            parent?.type === "ForStatement"
        ) {
            return group(
                node.expressions.map((expression, index) =>
                    index === 0
                        ? this.print(expression)
                        : [",", indent([line, this.print(expression)])],
                ),
            );
        }
        return group(
            join(
                [",", line],
                node.expressions.map((expression) => this.print(expression)),
            ),
        );
    }

    #cast(node: NodeOf<"TSAsExpression" | "TSSatisfiesExpression">): Doc {
        const keyword = node.type === "TSAsExpression" ? "as" : "satisfies";
        const parts: Doc[] = [
            this.print(node.expression),
            ` ${keyword} `,
            this.print(node.typeAnnotation),
        ];
        const parent = this.printer.parent();
        if (
            (parent?.type === "CallExpression" && parent.callee === node) ||
            (parent?.type === "MemberExpression" && parent.object === node)
        )
            return group([indent([softline, ...parts]), softline]);
        return parts;
    }

    // Conditionals

    /** Prints conditional expressions and conditional types, after Prettier's printTernary. */
    ternary(node: NodeOf<"ConditionalExpression" | "TSConditionalType">): Doc {
        const conditional = node.type === "ConditionalExpression";
        const consequent = conditional ? node.consequent : node.trueType;
        const alternate = conditional ? node.alternate : node.falseType;
        const tests = conditional
            ? [node.test]
            : [node.checkType, node.extendsType];
        const parent = this.printer.parent() as Node;
        const isParentTest =
            parent.type === node.type &&
            tests.length > 0 &&
            this.#testOf(parent).includes(node);
        let forceNoIndent = parent.type === node.type && !isParentTest;

        let current: Node | undefined;
        let previous: Node = node;
        let level = 0;
        do {
            previous = current ?? node;
            current = this.printer.parent(level);
            level++;
        } while (
            current &&
            current.type === node.type &&
            !this.#testOf(current).includes(previous)
        );
        const firstNonConditionalParent = current ?? parent;

        const parts: Doc[] = [];
        let jsxMode = false;
        if (
            conditional &&
            (Nodes.isJsx(node.test) ||
                Nodes.isJsx(consequent) ||
                Nodes.isJsx(alternate) ||
                this.#chainHasJsx(previous))
        ) {
            jsxMode = true;
            forceNoIndent = true;
            const wrap = (doc: Doc): Doc => [
                ifBreak("("),
                indent([softline, doc]),
                softline,
                ifBreak(")"),
            ];
            const isNil = (child: Node) =>
                child.type === "NullLiteral" ||
                (child.type === "Identifier" && child.name === "undefined");
            parts.push(
                " ? ",
                isNil(consequent)
                    ? this.print(consequent)
                    : wrap(this.print(consequent)),
                " : ",
                alternate.type === node.type || isNil(alternate)
                    ? this.print(alternate)
                    : wrap(this.print(alternate)),
            );
        } else {
            const branch = (child: Node): Doc =>
                this.printer.useTabs
                    ? indent(this.print(child))
                    : align(2, this.print(child));
            const part: Doc[] = [
                line,
                "? ",
                consequent.type === node.type ? ifBreak("", "(") : "",
                branch(consequent),
                consequent.type === node.type ? ifBreak("", ")") : "",
                line,
                ": ",
                branch(alternate),
            ];
            parts.push(
                parent.type !== node.type ||
                    (conditional
                        ? (parent as NodeOf<"ConditionalExpression">)
                              .alternate === node
                        : (parent as NodeOf<"TSConditionalType">).falseType ===
                          node) ||
                    isParentTest
                    ? part
                    : this.printer.useTabs
                      ? dedent(indent(part))
                      : align(Math.max(0, this.options.indentWidth - 2), part),
            );
        }

        const shouldBreak = [consequent, alternate, ...tests].some((child) =>
            this.printer.hasComment(
                child,
                (comment) =>
                    comment.type === "Block" &&
                    this.printer.hasNewlineInRange(comment.start, comment.end),
            ),
        );
        const maybeGroup = (doc: Doc): Doc =>
            parent === firstNonConditionalParent
                ? group(doc, { shouldBreak })
                : shouldBreak
                  ? [doc, breakParent]
                  : doc;
        const breakClosingParen =
            !jsxMode &&
            parent.type === "MemberExpression" &&
            !parent.computed &&
            parent.object === node;
        const extraIndent = this.#extraIndent(node);

        const testDoc: Doc = conditional
            ? this.print(node.test)
            : [
                  this.print(node.checkType),
                  " extends ",
                  this.print(node.extendsType),
              ];
        const alignedTest =
            parent.type === node.type &&
            (conditional
                ? (parent as NodeOf<"ConditionalExpression">).alternate === node
                : (parent as NodeOf<"TSConditionalType">).falseType === node)
                ? this.printer.useTabs
                    ? indent(testDoc)
                    : align(2, testDoc)
                : testDoc;
        const result = maybeGroup([
            alignedTest,
            forceNoIndent ? parts : indent(parts),
            conditional && breakClosingParen && !extraIndent ? softline : "",
        ]);
        const cast =
            parent.type === "TSAsExpression" ||
            parent.type === "TSSatisfiesExpression" ||
            ((parent.type === "CallExpression" ||
                parent.type === "NewExpression") &&
                parent.callee === node);
        return isParentTest || extraIndent || cast
            ? group([indent([softline, result]), softline])
            : result;
    }

    #testOf(node: Node): Node[] {
        if (node.type === "ConditionalExpression") return [node.test];
        if (node.type === "TSConditionalType")
            return [node.checkType, node.extendsType];
        return [];
    }

    #chainHasJsx(node: Node): boolean {
        const stack: Node[] = [node];
        while (stack.length > 0) {
            const current = stack.pop() as Node;
            if (current.type !== "ConditionalExpression") continue;
            for (const child of [
                current.test,
                current.consequent,
                current.alternate,
            ]) {
                if (Nodes.isJsx(child)) return true;
                stack.push(child);
            }
        }
        return false;
    }

    /** `(a ? b : c).d()` member chains get an extra indent, after Prettier's shouldExtraIndentForConditionalExpression. */
    #extraIndent(node: Node): boolean {
        if (node.type !== "ConditionalExpression") return false;
        let child: Node = node;
        let parent: Node | undefined;
        for (const ancestor of this.printer.ancestors()) {
            if (
                (ancestor.type === "CallExpression" &&
                    ancestor.callee === child) ||
                (ancestor.type === "MemberExpression" &&
                    ancestor.object === child) ||
                (ancestor.type === "TSNonNullExpression" &&
                    ancestor.expression === child)
            ) {
                child = ancestor;
                parent = ancestor;
                continue;
            }
            break;
        }
        if (!parent || child === node) return false;
        return (
            Nodes.isCall(child) &&
            Nodes.isMember((child as NodeOf<"CallExpression">).callee) &&
            this.printer.parent()?.type === "MemberExpression"
        );
    }

    // Binary expressions

    /** Prints `a && b || c` chains, after Prettier's printBinaryishExpression. */
    #binaryish(node: NodeOf<"BinaryExpression" | "LogicalExpression">): Doc {
        const parent = this.printer.parent() as Node;
        const grandparent = this.printer.parent(1);
        const insideParenthesis =
            (parent.type === "IfStatement" ||
                parent.type === "WhileStatement" ||
                parent.type === "SwitchStatement" ||
                parent.type === "DoWhileStatement") &&
            ("test" in parent
                ? parent.test === node
                : (parent as NodeOf<"SwitchStatement">).discriminant === node);

        const parts = this.binaryParts(node, false, insideParenthesis);
        if (insideParenthesis) return parts;

        if (
            (parent.type === "UnaryExpression" ||
                (Nodes.isCall(parent) &&
                    (parent as NodeOf<"CallExpression">).callee === node) ||
                (parent.type === "MemberExpression" &&
                    parent.object === node &&
                    !parent.computed)) &&
            !(parent.type === "MemberExpression" && parent.computed)
        ) {
            return group([indent([softline, ...parts]), softline]);
        }

        const shouldNotIndent =
            parent.type === "ReturnStatement" ||
            parent.type === "ThrowStatement" ||
            (parent.type === "JSXExpressionContainer" &&
                grandparent?.type === "JSXAttribute") ||
            (parent.type === "ArrowFunctionExpression" &&
                parent.body === node) ||
            (parent.type === "ForStatement" && parent.body !== node) ||
            (parent.type === "ConditionalExpression" &&
                grandparent?.type !== "ReturnStatement" &&
                grandparent?.type !== "ThrowStatement" &&
                !Nodes.isCall(grandparent) &&
                grandparent?.type !== "MetaProperty") ||
            parent.type === "TemplateLiteral";

        const shouldIndentIfInlining =
            parent.type === "AssignmentExpression" ||
            parent.type === "VariableDeclarator" ||
            parent.type === "PropertyDefinition" ||
            parent.type === "Property";
        const samePrecedenceSubExpression =
            Nodes.isBinaryish(node.left) &&
            Nodes.shouldFlatten(node.operator, node.left.operator);

        if (
            shouldNotIndent ||
            (Nodes.shouldInlineLogical(node) && !samePrecedenceSubExpression) ||
            (!Nodes.shouldInlineLogical(node) && shouldIndentIfInlining)
        ) {
            return group(parts);
        }
        if (parts.length === 0) return "";

        const hasJsx = Nodes.isJsx(node.right);
        const firstGroup = parts.findIndex(
            (part) =>
                typeof part !== "string" &&
                !Array.isArray(part) &&
                part.type === "group",
        );
        const head = parts.slice(0, firstGroup === -1 ? 1 : firstGroup + 1);
        const rest = parts.slice(head.length, hasJsx ? -1 : undefined);
        const id = Symbol("logical");
        const chain = group([...head, indent(rest)], { id });
        if (!hasJsx) return chain;
        return group([chain, indentIfBreak(parts.at(-1) as Doc, id)]);
    }

    /** Flattens same precedence operands into parts with line breaks between them. */
    binaryParts(
        node: Node,
        nested: boolean,
        insideParenthesis: boolean,
    ): Doc[] {
        if (!Nodes.isBinaryish(node)) return [group(this.print(node))];

        const { left } = node;
        let parts: Doc[] = [];
        if (
            Nodes.isBinaryish(left) &&
            Nodes.shouldFlatten(node.operator, left.operator)
        ) {
            parts = this.printer.within(left, () =>
                this.binaryParts(left, true, insideParenthesis),
            );
        } else {
            parts.push(group(this.print(left)));
        }

        const inline = Nodes.shouldInlineLogical(node);
        const before = this.options.operatorLinebreak === "before";
        let right: Doc;
        if (inline) right = [node.operator, " ", this.print(node.right)];
        else if (before) {
            // comments of the right operand go before the operator starting its line
            const { leading, doc } = this.printer.printLeadingSeparately(
                node.right,
            );
            right = [line, leading, node.operator, " ", doc];
        } else right = [node.operator, line, this.print(node.right)];

        const shouldBreak = this.printer.hasComment(
            left,
            (comment) =>
                comment.placement === "trailing" && comment.type === "Line",
        );
        const shouldGroup =
            shouldBreak ||
            (!(insideParenthesis && node.type === "LogicalExpression") &&
                this.printer.parent()?.type !== node.type &&
                left.type !== node.type &&
                node.right.type !== node.type);

        parts.push(
            before && !inline ? "" : " ",
            shouldGroup ? group(right, { shouldBreak }) : right,
        );
        if (nested && this.printer.hasComment(node))
            return [this.printer.withComments(node, parts)];
        return parts;
    }
}
