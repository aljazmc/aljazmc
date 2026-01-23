import type { Node, NodeOf } from "@aljazmc/syntax";
import {
    type Doc,
    group,
    hardline,
    ifBreak,
    indent,
    join,
    line,
} from "../doc.js";
import Assignments from "./assignments.js";
import Expressions from "./expressions.js";
import Section from "./section.js";

type Class = NodeOf<"ClassDeclaration" | "ClassExpression">;

/** Classes, their members and decorators. */
export default class Classes extends Section {
    override register(): void {
        const p = this.printer;
        p.handle(["ClassDeclaration", "ClassExpression"], (node) => [
            this.decorators(node),
            this.#class(node),
        ]);
        p.handle(["ClassBody"], (node) => this.#body(node));
        p.handle(["MethodDefinition"], (node) => [
            this.#memberDecorators(node),
            this.#modifiers(node),
            this.#method(node),
        ]);
        p.handle(["PropertyDefinition"], (node) => [
            this.#memberDecorators(node),
            this.#property(node),
        ]);
        p.handle(["Decorator"], (node) => ["@", this.print(node.expression)]);
        p.handle(["TSParameterProperty"], (node) => [
            node.decorators.length > 0
                ? [
                      join(
                          " ",
                          node.decorators.map((decorator) =>
                              this.print(decorator),
                          ),
                      ),
                      " ",
                  ]
                : "",
            node.accessibility ? `${node.accessibility} ` : "",
            node.override ? "override " : "",
            node.readonly ? "readonly " : "",
            this.print(node.parameter),
        ]);
    }

    /** Class decorators on their own lines, unless they were on the class line. */
    decorators(node: Class): Doc {
        if (node.decorators.length === 0) return "";
        const parent = this.printer.parent();
        if (
            parent?.type === "ExportNamedDeclaration" ||
            parent?.type === "ExportDefaultDeclaration"
        ) {
            if ((node.decorators[0]?.start ?? 0) < parent.start) return "";
        }
        const printed = node.decorators.map((decorator) =>
            this.print(decorator),
        );
        const sameLine =
            node.type === "ClassExpression" ||
            (!this.printer.hasNewlineInRange(
                (node.decorators[0] as Node).start,
                (node.decorators.at(-1) as Node).end,
            ) &&
                !this.printer.hasNewline((node.decorators.at(-1) as Node).end));
        return sameLine
            ? [join(" ", printed), " "]
            : [join(hardline, printed), hardline];
    }

    #class(node: Class): Doc {
        const parts: Doc[] = [
            node.declare ? "declare " : "",
            node.abstract ? "abstract " : "",
            "class",
        ];
        const groupMode =
            (node.id !== null && this.printer.hasTrailingComment(node.id)) ||
            (node.superClass !== null &&
                this.printer.hasComment(node.superClass)) ||
            node.implements.length > 0;
        const head: Doc[] = [];
        const heritage: Doc[] = [];

        if (node.id) head.push(" ", this.print(node.id));
        head.push(this.print(node.typeParameters));

        if (node.superClass) {
            const superClass: Doc = [
                "extends ",
                this.print(node.superClass),
                this.print(node.superTypeArguments),
            ];
            heritage.push(groupMode ? line : " ", superClass);
        }
        if (node.implements.length > 0) {
            heritage.push(
                line,
                "implements ",
                group(
                    indent(
                        join(
                            [",", line],
                            node.implements.map((type) => this.print(type)),
                        ),
                    ),
                ),
            );
        }

        const body = this.print(node.body);
        if (groupMode) {
            const id = Symbol("heritage");
            const indentOnlyHeritage =
                node.typeParameters !== null &&
                !this.printer.hasTrailingComment(node.typeParameters);
            parts.push(
                group(
                    indentOnlyHeritage
                        ? [...head, indent(heritage)]
                        : indent([...head, heritage]),
                    { id },
                ),
                // a broken heritage clause puts the body brace on its own line
                node.body.body.length > 0 ? ifBreak(hardline, " ", id) : " ",
                body,
            );
            return parts;
        }

        parts.push(...head, ...heritage, " ", body);
        return parts;
    }

    #body(node: NodeOf<"ClassBody">): Doc {
        const parts: Doc[] = [];
        for (const [index, member] of node.body.entries()) {
            parts.push(this.print(member));
            const next = node.body[index + 1];
            if (
                !this.options.semicolons &&
                member.type === "PropertyDefinition" &&
                this.#needsSemicolon(member, next)
            )
                parts.push(";");
            if (next) {
                parts.push(hardline);
                if (this.printer.isNextLineEmpty(member.end))
                    parts.push(hardline);
            }
        }
        const dangling = this.printer.dangling(node);
        if (dangling !== "")
            parts.push(parts.length > 0 ? hardline : "", dangling);
        if (parts.length === 0) return "{}";
        return ["{", indent([hardline, parts]), hardline, "}"];
    }

    /** Without semicolons, a class property needs one before members that would join it. */
    #needsSemicolon(
        member: NodeOf<"PropertyDefinition">,
        next: Node | undefined,
    ): boolean {
        if (
            !member.value &&
            !member.typeAnnotation &&
            !member.computed &&
            member.key.type === "Identifier" &&
            ["static", "get", "set"].includes(member.key.name)
        )
            return true;
        if (!next) return false;
        if (
            next.type === "MethodDefinition" ||
            next.type === "PropertyDefinition"
        ) {
            if (next.computed) return true;
            if (
                next.type === "MethodDefinition" &&
                next.value.generator &&
                !next.value.async &&
                !next.static
            )
                return true;
            if (
                next.type === "MethodDefinition" &&
                next.kind !== "method" &&
                next.kind !== "constructor"
            )
                return false;
            const name = next.key.type === "Identifier" ? next.key.name : "";
            if (["in", "instanceof"].includes(name)) return true;
        }
        if (next.type === "TSIndexSignature") return true;
        return false;
    }

    /** Decorators of members, inline or on their own lines as in the source. */
    #memberDecorators(
        node: NodeOf<"MethodDefinition" | "PropertyDefinition">,
    ): Doc {
        if (node.decorators.length === 0) return "";
        const last = node.decorators.at(-1) as Node;
        const newline =
            this.printer.hasNewlineInRange(last.end, node.key.start) ||
            this.printer.hasNewlineInRange(
                (node.decorators[0] as Node).start,
                last.end,
            );
        return group([
            join(
                line,
                node.decorators.map((decorator) => this.print(decorator)),
            ),
            newline ? hardline : line,
        ]);
    }

    #modifiers(node: NodeOf<"MethodDefinition" | "PropertyDefinition">): Doc {
        return [
            node.declare ? "declare " : "",
            node.accessibility ? `${node.accessibility} ` : "",
            node.static ? "static " : "",
            node.abstract ? "abstract " : "",
            node.override ? "override " : "",
            node.readonly ? "readonly " : "",
        ];
    }

    #method(node: NodeOf<"MethodDefinition">): Doc {
        const { value } = node;
        const parts: Doc[] = [];
        if (node.kind === "get" || node.kind === "set")
            parts.push(node.kind, " ");
        else if (value.async) parts.push("async ");
        if (value.generator) parts.push("*");
        parts.push(
            this.printer.section(Expressions).propertyKey(node),
            node.optional ? "?" : "",
            this.print(value),
        );
        if (!value.body) parts.push(this.printer.semi);
        return parts;
    }

    #property(node: NodeOf<"PropertyDefinition">): Doc {
        const key = this.printer.section(Expressions).propertyKey(node);
        const left: Doc = [
            this.#modifiers(node),
            node.accessor ? "accessor " : "",
            key,
            node.optional ? "?" : "",
            node.definite ? "!" : "",
            this.printer
                .section(Expressions)
                .typeAnnotation(node.typeAnnotation),
        ];
        return [
            this.printer
                .section(Assignments)
                .printAssignment(node, left, " =", node.value),
            this.printer.semi,
        ];
    }
}
