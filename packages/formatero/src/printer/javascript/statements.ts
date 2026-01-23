import type { Node, NodeOf } from "@aljazmc/syntax";
import {
    type Doc,
    group,
    hardline,
    ifBreak,
    indent,
    join,
    line,
    softline,
} from "../doc.js";
import Nodes from "./nodes.js";
import Section from "./section.js";

/** Statements, blocks and statement sequences. */
export default class Statements extends Section {
    override register(): void {
        const p = this.printer;
        p.handle(["Program"], (node) =>
            this.#body(node, node.body, node.directives),
        );
        p.handle(["BlockStatement", "StaticBlock"], (node) => this.block(node));
        p.handle(["TSModuleBlock"], (node) => this.block(node));
        p.handle(["EmptyStatement"], () => "");
        p.handle(["ExpressionStatement"], (node) => [
            this.print(node.expression),
            this.#statementSemi(node),
        ]);
        p.handle(["Directive"], (node) => [
            this.#directive(node.value.raw),
            p.semi,
        ]);
        p.handle(["VariableDeclaration"], (node) => this.#variables(node));
        p.handle(["IfStatement"], (node) => this.#if(node));
        p.handle(["ForStatement"], (node) => this.#for(node));
        p.handle(["ForInStatement"], (node) =>
            group([
                "for (",
                this.print(node.left),
                " in ",
                this.print(node.right),
                ")",
                this.#clause(node.body),
            ]),
        );
        p.handle(["ForOfStatement"], (node) =>
            group([
                "for",
                node.await ? " await" : "",
                " (",
                this.print(node.left),
                " of ",
                this.print(node.right),
                ")",
                this.#clause(node.body),
            ]),
        );
        p.handle(["WhileStatement"], (node) =>
            group([
                "while (",
                group([indent([softline, this.print(node.test)]), softline]),
                ")",
                this.#clause(node.body),
            ]),
        );
        p.handle(["DoWhileStatement"], (node) => [
            group(["do", this.#clause(node.body)]),
            node.body.type === "BlockStatement" ? " " : hardline,
            "while (",
            group([indent([softline, this.print(node.test)]), softline]),
            ")",
            p.semi,
        ]);
        p.handle(["BreakStatement", "ContinueStatement"], (node) => [
            node.type === "BreakStatement" ? "break" : "continue",
            node.label ? [" ", this.print(node.label)] : "",
            p.semi,
        ]);
        p.handle(["LabeledStatement"], (node) =>
            node.body.type === "EmptyStatement"
                ? [this.print(node.label), ":;"]
                : [this.print(node.label), ": ", this.print(node.body)],
        );
        p.handle(["TryStatement"], (node) => [
            "try ",
            this.print(node.block),
            node.handler ? [" ", this.print(node.handler)] : "",
            node.finalizer ? [" finally ", this.print(node.finalizer)] : "",
        ]);
        p.handle(["CatchClause"], (node) => this.#catch(node));
        p.handle(["SwitchStatement"], (node) => this.#switch(node));
        p.handle(["SwitchCase"], (node) => this.#case(node));
        p.handle(["DebuggerStatement"], () => ["debugger", p.semi]);
        p.handle(["ReturnStatement", "ThrowStatement"], (node) => [
            node.type === "ReturnStatement" ? "return" : "throw",
            this.#argument(node),
        ]);
        p.handle(["WithStatement"], (node) =>
            group([
                "with (",
                this.print(node.object),
                ")",
                this.#clause(node.body),
            ]),
        );
    }

    block(
        node: NodeOf<"BlockStatement" | "StaticBlock" | "TSModuleBlock">,
    ): Doc {
        const directives =
            node.type === "BlockStatement" ? node.directives : [];
        const body = this.#body(node, node.body, directives);
        const prefix = node.type === "StaticBlock" ? "static " : "";
        if (body !== "")
            return [prefix, "{", indent([hardline, body]), hardline, "}"];
        return [prefix, "{", this.#emptyBlockBreaks(node) ? hardline : "", "}"];
    }

    /** Empty blocks print `{}` in functions, loops and alike, elsewhere `{` and `}` on two lines. */
    #emptyBlockBreaks(node: Node): boolean {
        if (node.type !== "BlockStatement") return false;
        const parent = this.printer.parent();
        if (!parent) return false;
        switch (parent.type) {
            case "ArrowFunctionExpression":
            case "FunctionExpression":
            case "FunctionDeclaration":
            case "ForStatement":
            case "ForInStatement":
            case "ForOfStatement":
            case "WhileStatement":
            case "DoWhileStatement":
            case "TSModuleDeclaration":
                return false;
            case "CatchClause":
                return (
                    (this.printer.parent(1) as NodeOf<"TryStatement">)
                        .finalizer !== null
                );
            default:
                return true;
        }
    }

    #body(node: Node, body: Node[], directives: Node[]): Doc {
        const statements = body.filter(
            (statement) => statement.type !== "EmptyStatement",
        );
        const dangling = this.printer.dangling(node);
        if (
            directives.length === 0 &&
            statements.length === 0 &&
            dangling === ""
        )
            return "";

        const parts: Doc[] = [];
        if (directives.length > 0) {
            parts.push(this.sequence(directives));
            if (statements.length > 0 || dangling !== "") {
                parts.push(hardline);
                if (
                    this.printer.isNextLineEmpty(
                        (directives.at(-1) as Node).end,
                    )
                )
                    parts.push(hardline);
            }
        }
        if (statements.length > 0) parts.push(this.sequence(body));
        if (dangling !== "")
            parts.push(statements.length > 0 ? hardline : "", dangling);
        return parts;
    }

    /**
     * Statements on their own lines, keeping single blank lines between them,
     * judged after the last statement before the next printed one, like an empty `;`.
     */
    sequence(statements: Node[]): Doc {
        const parts: Doc[] = [];
        const printable = statements.filter(
            (statement) => statement.type !== "EmptyStatement",
        );

        for (const [index, statement] of printable.entries()) {
            const needsSemi =
                !this.options.semicolons &&
                !this.options.json &&
                statement.type === "ExpressionStatement" &&
                this.needsASIProtection(statement);
            parts.push(this.print(statement, { needsSemi }));

            const next = printable[index + 1];
            if (!next) continue;
            const before =
                statements[statements.indexOf(next) - 1] ?? statement;
            parts.push(hardline);
            if (this.printer.isNextLineEmpty(before.end)) parts.push(hardline);
        }
        return parts;
    }

    #statementSemi(node: NodeOf<"ExpressionStatement">): Doc {
        if (this.options.json) return "";
        const dangling = this.printer.dangling(node);
        return [this.printer.semi, dangling === "" ? "" : [" ", dangling]];
    }

    /** Whether an expression statement needs a leading `;` without semicolons. */
    needsASIProtection(statement: NodeOf<"ExpressionStatement">): boolean {
        const { expression } = statement;
        return this.printer.within(statement, () =>
            this.printer.within(expression, () =>
                this.#startsWithHazard(expression),
            ),
        );
    }

    /** Walks the leftmost path, with each node current so parentheses are known. */
    #startsWithHazard(node: Node): boolean {
        if (this.printer.needsParentheses(node)) return true;
        switch (node.type) {
            case "ArrayExpression":
            case "ArrayPattern":
            case "TemplateLiteral":
            case "RegExpLiteral":
            case "JSXElement":
            case "TSTypeAssertion":
                return true;
            case "ArrowFunctionExpression":
                return !(
                    this.options.arrowParentheses === "asNeeded" &&
                    node.params.length === 1 &&
                    node.params[0]?.type === "Identifier" &&
                    !node.params[0].typeAnnotation &&
                    !node.typeParameters &&
                    !node.returnType
                );
            case "UnaryExpression":
                return node.operator === "+" || node.operator === "-";
        }
        const left = this.#leftChild(node);
        return (
            left !== undefined &&
            this.printer.within(left, () => this.#startsWithHazard(left))
        );
    }

    #leftChild(node: Node): Node | undefined {
        switch (node.type) {
            case "SequenceExpression":
                return node.expressions[0];
            case "AssignmentExpression":
            case "BinaryExpression":
            case "LogicalExpression":
                return node.left;
            case "MemberExpression":
                return node.object;
            case "CallExpression":
                return node.callee;
            case "TaggedTemplateExpression":
                return node.tag;
            case "ConditionalExpression":
                return node.test;
            case "UpdateExpression":
                return node.prefix ? undefined : node.argument;
            case "TSAsExpression":
            case "TSSatisfiesExpression":
            case "TSNonNullExpression":
                return node.expression;
            default:
                return undefined;
        }
    }

    #directive(raw: string): string {
        const content = raw.slice(1, -1);
        if (content.includes('"') || content.includes("'")) return raw;
        return this.options.quote + content + this.options.quote;
    }

    #variables(node: NodeOf<"VariableDeclaration">): Doc {
        const parent = this.printer.parent();
        const inFor =
            parent?.type === "ForStatement" ||
            parent?.type === "ForInStatement" ||
            parent?.type === "ForOfStatement";
        const hasValue = node.declarations.some(
            (declaration) => declaration.init,
        );
        const printed = node.declarations.map((declaration) =>
            this.print(declaration),
        );
        const first =
            printed.length === 1 &&
            !this.printer.hasLeadingComment(node.declarations[0])
                ? printed[0]
                : indent(printed[0] ?? "");
        const semi =
            inFor && (parent as { body?: Node }).body !== node
                ? ""
                : this.printer.semi;

        return group([
            node.declare ? "declare " : "",
            node.kind,
            first ? [" ", first] : "",
            indent(
                printed
                    .slice(1)
                    .map((declaration) => [
                        ",",
                        hasValue && !inFor ? hardline : line,
                        declaration,
                    ]),
            ),
            semi,
        ]);
    }

    /** Places a statement body after its head: blocks on the same line, others indented. */
    #clause(body: Node, forceSpace = false): Doc {
        if (body.type === "EmptyStatement") return ";";
        if (body.type === "BlockStatement" || forceSpace)
            return [" ", this.print(body)];
        return indent([line, this.print(body)]);
    }

    #if(node: NodeOf<"IfStatement">): Doc {
        const parts: Doc[] = [
            group([
                "if (",
                group([indent([softline, this.print(node.test)]), softline]),
                ")",
                this.#clause(node.consequent),
            ]),
        ];

        if (node.alternate) {
            const ownLine =
                this.printer.hasTrailingLineComment(node.consequent) ||
                this.printer.hasComment(
                    node,
                    (comment) =>
                        comment.placement === "dangling" &&
                        comment.type === "Line",
                );
            parts.push(
                node.consequent.type === "BlockStatement" && !ownLine
                    ? " "
                    : hardline,
            );
            if (this.printer.hasDangling(node))
                parts.push(
                    this.printer.dangling(node),
                    ownLine ? hardline : " ",
                );
            parts.push(
                "else",
                group(
                    this.#clause(
                        node.alternate,
                        node.alternate.type === "IfStatement",
                    ),
                ),
            );
        }

        return group(parts);
    }

    #for(node: NodeOf<"ForStatement">): Doc {
        const body = this.#clause(node.body);
        const dangling = this.printer.dangling(node);
        const comments = dangling === "" ? "" : [dangling, softline];
        if (!node.init && !node.test && !node.update)
            return [comments, group(["for (;;)", body])];
        return [
            comments,
            group([
                "for (",
                group([
                    indent([
                        softline,
                        this.print(node.init),
                        ";",
                        line,
                        this.print(node.test),
                        ";",
                        // a missing update leaves `; )` on one line, nothing when broken
                        node.update
                            ? [line, this.print(node.update)]
                            : ifBreak("", " "),
                    ]),
                    softline,
                ]),
                ")",
                body,
            ]),
        ];
    }

    #catch(node: NodeOf<"CatchClause">): Doc {
        if (!node.param) return ["catch ", this.print(node.body)];
        const commented = this.printer.hasComment(
            node.param,
            (comment) =>
                comment.type === "Line" ||
                (comment.placement === "leading" &&
                    this.printer.hasNewline(comment.end)) ||
                (comment.placement === "trailing" &&
                    this.printer.hasNewline(comment.start, true)),
        );
        const param = this.print(node.param);
        return [
            "catch (",
            commented ? [indent([softline, param]), softline] : param,
            ") ",
            this.print(node.body),
        ];
    }

    #switch(node: NodeOf<"SwitchStatement">): Doc {
        const cases = node.cases.map((child, index) => [
            this.print(child),
            index < node.cases.length - 1 &&
            this.printer.isNextLineEmpty(child.end)
                ? hardline
                : "",
        ]);
        return [
            group([
                "switch (",
                indent([softline, this.print(node.discriminant)]),
                softline,
                ")",
            ]),
            " {",
            cases.length > 0 ? indent([hardline, join(hardline, cases)]) : "",
            hardline,
            "}",
        ];
    }

    #case(node: NodeOf<"SwitchCase">): Doc {
        const parts: Doc[] = [
            node.test ? ["case ", this.print(node.test), ":"] : "default:",
        ];
        if (this.printer.hasDangling(node))
            parts.push(" ", this.printer.dangling(node));
        const consequent = node.consequent.filter(
            (statement) => statement.type !== "EmptyStatement",
        );
        if (consequent.length > 0) {
            const printed = this.sequence(consequent);
            parts.push(
                consequent.length === 1 &&
                    consequent[0]?.type === "BlockStatement"
                    ? [" ", printed]
                    : indent([hardline, printed]),
            );
        }
        return parts;
    }

    #argument(node: NodeOf<"ReturnStatement" | "ThrowStatement">): Doc {
        const parts: Doc[] = [];
        const argument = node.argument;
        if (argument) {
            if (this.#leadingComment(argument))
                parts.push([
                    " (",
                    indent([hardline, this.print(argument)]),
                    hardline,
                    ")",
                ]);
            // throw arguments get theirs from Parentheses
            else if (
                argument.type === "SequenceExpression" &&
                node.type === "ReturnStatement"
            )
                parts.push(
                    group([
                        " (",
                        indent([softline, this.print(argument)]),
                        softline,
                        ")",
                    ]),
                );
            else if (Nodes.isBinaryish(argument))
                parts.push(
                    group([
                        " ",
                        ifBreak("("),
                        indent([softline, this.print(argument)]),
                        softline,
                        ifBreak(")"),
                    ]),
                );
            else parts.push(" ", this.print(argument));
        }
        const dangling = this.printer.dangling(node);
        const lastLine = node.comments?.at(-1)?.type === "Line";
        if (lastLine) parts.push(this.printer.semi);
        if (dangling !== "") parts.push(" ", dangling);
        if (!lastLine) parts.push(this.printer.semi);
        return parts;
    }

    /** Whether the return argument starts with a comment on its own line. */
    #leadingComment(argument: Node): boolean {
        if (this.printer.hasLeadingOwnLineComment(argument)) return true;
        const left = Nodes.leftmost(argument);
        return left !== argument && this.printer.hasLeadingOwnLineComment(left);
    }
}
