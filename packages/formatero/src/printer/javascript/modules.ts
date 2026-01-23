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
import Section from "./section.js";

type WithSpecifiers = NodeOf<"ExportNamedDeclaration" | "ImportDeclaration">;

/** Import and export declarations. */
export default class Modules extends Section {
    override register(): void {
        const p = this.printer;
        p.handle(["ImportDeclaration"], (node) => this.#import(node));
        p.handle(["ImportSpecifier"], (node) => [
            node.importKind === "type" ? "type " : "",
            this.print(node.imported),
            node.local.start !== node.imported.start
                ? [" as ", this.print(node.local)]
                : "",
        ]);
        p.handle(["ImportDefaultSpecifier"], (node) => this.print(node.local));
        p.handle(["ImportNamespaceSpecifier"], (node) => [
            "* as ",
            this.print(node.local),
        ]);
        p.handle(["ImportAttribute"], (node) => [
            this.print(node.key),
            ": ",
            this.print(node.value),
        ]);
        p.handle(["ExportNamedDeclaration"], (node) => this.#exportNamed(node));
        p.handle(["ExportSpecifier"], (node) => [
            node.exportKind === "type" ? "type " : "",
            this.print(node.local),
            node.exported.start !== node.local.start
                ? [" as ", this.print(node.exported)]
                : "",
        ]);
        p.handle(["ExportDefaultDeclaration"], (node) =>
            this.#exportDefault(node),
        );
        p.handle(["ExportAllDeclaration"], (node) => [
            "export",
            node.exportKind === "type" ? " type" : "",
            " *",
            node.exported ? [" as ", this.print(node.exported)] : "",
            " from ",
            this.print(node.source),
            this.#attributes(node),
            this.printer.semi,
        ]);
    }

    #import(node: NodeOf<"ImportDeclaration">): Doc {
        const braces =
            node.specifiers.length > 0 ||
            /^import\s+(?:type\s+)?\{/.test(this.printer.text(node));
        return [
            "import",
            node.phase ? ` ${node.phase}` : "",
            node.importKind !== "value" ? ` ${node.importKind}` : "",
            braces ? [this.#specifiers(node, " "), " from"] : "",
            " ",
            this.print(node.source),
            this.#attributes(node),
            this.printer.semi,
        ];
    }

    #exportNamed(node: NodeOf<"ExportNamedDeclaration">): Doc {
        const parts: Doc[] = [this.#decoratorsBeforeExport(node), "export"];
        const dangling = this.printer.dangling(node);
        if (dangling !== "") parts.push(" ", dangling, hardline);

        if (node.declaration) {
            parts.push(" ", this.print(node.declaration));
            return parts;
        }

        parts.push(
            node.exportKind === "type" ? " type" : "",
            this.#specifiers(node, " "),
        );
        if (node.source)
            parts.push(
                " from ",
                this.print(node.source),
                this.#attributes(node),
            );
        parts.push(this.printer.semi);
        return parts;
    }

    #exportDefault(node: NodeOf<"ExportDefaultDeclaration">): Doc {
        const { declaration } = node;
        const declarative = [
            "ClassDeclaration",
            "FunctionDeclaration",
            "TSInterfaceDeclaration",
            "TSDeclareFunction",
            "TSEnumDeclaration",
        ].includes(declaration.type);
        return [
            this.#decoratorsBeforeExport(node),
            "export default ",
            this.print(declaration),
            declarative ? "" : this.printer.semi,
        ];
    }

    /** Decorators written before `export` stay there. */
    #decoratorsBeforeExport(
        node: NodeOf<"ExportDefaultDeclaration" | "ExportNamedDeclaration">,
    ): Doc {
        const declaration = node.declaration;
        if (
            !declaration ||
            (declaration.type !== "ClassDeclaration" &&
                declaration.type !== "ClassExpression")
        )
            return "";
        const decorators = declaration.decorators.filter(
            (decorator) => decorator.start < node.start,
        );
        if (decorators.length === 0) return "";
        return [
            join(
                hardline,
                decorators.map((decorator) => this.print(decorator)),
            ),
            hardline,
        ];
    }

    #specifiers(node: WithSpecifiers, prefix: string): Doc {
        if (node.specifiers.length === 0) return [prefix, "{}"];

        const standalone: Doc[] = [];
        const grouped: Doc[] = [];
        for (const specifier of node.specifiers) {
            if (
                specifier.type === "ImportDefaultSpecifier" ||
                specifier.type === "ImportNamespaceSpecifier"
            )
                standalone.push(this.print(specifier));
            else grouped.push(this.print(specifier));
        }

        const parts: Doc[] = [prefix, join(", ", standalone)];
        if (grouped.length > 0) {
            if (standalone.length > 0) parts.push(", ");
            const canBreak =
                grouped.length > 1 ||
                standalone.length > 0 ||
                node.specifiers.some((specifier) =>
                    this.printer.hasComment(specifier),
                );
            const space = this.options.bracketSpacing ? " " : "";
            if (canBreak) {
                const spacing = this.options.bracketSpacing ? line : softline;
                parts.push({
                    type: "group",
                    break: false,
                    contents: [
                        "{",
                        indent([spacing, join([",", line], grouped)]),
                        ifBreak(
                            this.options.trailingCommas === "none" ? "" : ",",
                        ),
                        spacing,
                        "}",
                    ],
                });
            } else parts.push("{", space, ...grouped, space, "}");
        }
        return parts;
    }

    /** Import attributes break like an object: `with { type: "json" }`. */
    #attributes(node: { attributes: Node[] }): Doc {
        if (node.attributes.length === 0) return "";
        const spacing = this.options.bracketSpacing ? line : softline;
        return [
            " with ",
            group([
                "{",
                indent([
                    spacing,
                    join(
                        [",", line],
                        node.attributes.map((attribute) =>
                            this.print(attribute),
                        ),
                    ),
                ]),
                ifBreak(this.options.trailingCommas === "none" ? "" : ","),
                spacing,
                "}",
            ]),
        ];
    }
}
