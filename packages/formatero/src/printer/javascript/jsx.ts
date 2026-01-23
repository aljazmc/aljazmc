import type { Node, NodeOf } from "@aljazmc/syntax";
import {
    conditionalGroup,
    type Doc,
    fill,
    group,
    hardline,
    ifBreak,
    indent,
    line,
    lineSuffixBoundary,
    softline,
    willBreak,
} from "../doc.js";
import Nodes from "./nodes.js";
import Section from "./section.js";

type Element = NodeOf<"JSXElement">;

const jsxWhitespacePattern = /([\t\n\f\r ]+)/;

/** JSX elements, attributes and children, after Prettier's JSX printer. */
export default class Jsx extends Section {
    override register(): void {
        const p = this.printer;
        p.handle(["JSXElement"], (node) => this.#wrap(this.#element(node)));
        p.handle(["JSXAttribute"], (node) => this.#attribute(node));
        p.handle(["JSXSpreadAttribute"], (node) => [
            "{...",
            this.print(node.argument),
            "}",
        ]);
        p.handle(["JSXSpreadChild"], (node) => [
            "{...",
            this.print(node.expression),
            "}",
        ]);
        p.handle(["JSXExpressionContainer"], (node) => this.#container(node));
        p.handle(["JSXText"], (node) => node.raw);
    }

    #wrap(doc: Doc): Doc {
        const parent = this.printer.parent();
        if (!parent) return doc;
        const noWrap = [
            "ArrayExpression",
            "JSXAttribute",
            "JSXElement",
            "JSXExpressionContainer",
            "ExpressionStatement",
            "CallExpression",
            "ConditionalExpression",
        ];
        if (noWrap.includes(parent.type)) return doc;
        const grandparent = this.printer.parent(1);
        const great = this.printer.parent(2);
        const shouldBreak =
            parent.type === "ArrowFunctionExpression" &&
            Nodes.isCall(grandparent) &&
            great?.type === "JSXExpressionContainer";
        const parens = this.printer.needsParentheses(this.printer.node);
        return group(
            [
                parens ? "" : ifBreak("("),
                indent([softline, doc]),
                softline,
                parens ? "" : ifBreak(")"),
            ],
            { shouldBreak },
        );
    }

    #opening(node: Element): Doc {
        const name: Doc =
            node.name === null
                ? ""
                : [node.name, this.print(node.typeArguments)];
        if (node.name === null) return "<>";
        if (node.selfClosing && node.attributes.length === 0)
            return ["<", name, " />"];

        const [only] = node.attributes;
        if (
            node.attributes.length === 1 &&
            only?.type === "JSXAttribute" &&
            only.value?.type === "StringLiteral" &&
            !only.value.raw.includes("\n") &&
            !this.printer.hasComment(only)
        ) {
            return group([
                "<",
                name,
                " ",
                this.print(only),
                node.selfClosing ? " />" : ">",
            ]);
        }

        const shouldBreak = node.attributes.some(
            (attribute) =>
                attribute.type === "JSXAttribute" &&
                attribute.value?.type === "StringLiteral" &&
                attribute.value.raw.includes("\n"),
        );
        const attributeLine =
            this.options.attributePosition === "multiline" &&
            node.attributes.length > 1
                ? hardline
                : line;
        const last = node.attributes.at(-1);
        const sameLine =
            this.options.bracketSameLine &&
            !(last && this.printer.hasTrailingComment(last));
        const end: Doc = node.selfClosing
            ? [line, "/>"]
            : sameLine
              ? ">"
              : [softline, ">"];

        return group(
            [
                "<",
                name,
                indent(
                    node.attributes.map((attribute) => [
                        attributeLine,
                        this.print(attribute),
                    ]),
                ),
                end,
            ],
            { shouldBreak },
        );
    }

    #closing(node: Element): Doc {
        if (node.selfClosing) return "";
        return node.name === null ? "</>" : ["</", node.name, ">"];
    }

    #element(node: Element): Doc {
        const opening = this.#opening(node);
        const closing = this.#closing(node);
        if (node.selfClosing) return opening;

        const children = node.children;
        if (
            children.length === 0 ||
            (children.length === 1 &&
                children[0]?.type === "JSXText" &&
                !this.#meaningful(children[0]))
        ) {
            return [opening, this.printer.dangling(node), closing];
        }

        const [first] = children;
        if (
            children.length === 1 &&
            first?.type === "JSXExpressionContainer" &&
            (first.expression?.type === "TemplateLiteral" ||
                first.expression?.type === "TaggedTemplateExpression")
        ) {
            return [opening, this.print(first), closing];
        }

        const normalized: Node[] = children.map((child) =>
            this.#whitespaceExpression(child)
                ? {
                      type: "JSXText",
                      start: child.start,
                      end: child.end,
                      raw: " ",
                  }
                : child,
        );

        const containsTag = normalized.some((child) => Nodes.isJsx(child));
        const containsMultipleExpressions =
            normalized.filter(
                (child) => child.type === "JSXExpressionContainer",
            ).length > 1;
        const containsMultipleAttributes = node.attributes.length > 1;
        let forcedBreak =
            willBreak(opening) ||
            containsTag ||
            containsMultipleAttributes ||
            containsMultipleExpressions;

        const quote = this.options.jsxQuote;
        const rawWhitespace = `{${quote} ${quote}}`;
        const jsxWhitespace: Doc = ifBreak([rawWhitespace, softline], " ");
        const parts = this.#children(normalized, jsxWhitespace);
        const containsText = normalized.some((child) =>
            this.#meaningful(child),
        );

        for (let index = parts.length - 2; index >= 0; index--) {
            const [a, b, c] = [
                parts[index],
                parts[index + 1],
                parts[index + 2],
            ];
            const pairOfEmptyStrings = a === "" && b === "";
            const pairOfHardlines =
                a === hardline && b === "" && c === hardline;
            const lineFollowedByWhitespace =
                (a === hardline || a === softline) &&
                b === "" &&
                c === jsxWhitespace;
            const whitespaceFollowedByLine =
                a === jsxWhitespace &&
                b === "" &&
                (c === hardline || c === softline);
            const doubleWhitespace =
                a === jsxWhitespace && b === "" && c === jsxWhitespace;
            const pairOfHardOrSoftLines =
                (a === softline && b === "" && c === hardline) ||
                (a === hardline && b === "" && c === softline);
            if (
                (pairOfHardlines && containsText) ||
                pairOfEmptyStrings ||
                lineFollowedByWhitespace ||
                doubleWhitespace
            )
                parts.splice(index, 2);
            else if (whitespaceFollowedByLine || pairOfHardOrSoftLines)
                parts.splice(index + 1, 2);
        }

        const isLine = (doc: Doc | undefined) =>
            doc === hardline || doc === softline || doc === line;
        while (
            parts.length > 0 &&
            (isLine(parts.at(-1)) || parts.at(-1) === "")
        )
            parts.pop();
        while (
            parts.length > 1 &&
            (isLine(parts[0]) || parts[0] === "") &&
            (isLine(parts[1]) || parts[1] === "")
        )
            parts.splice(0, 2);

        const multiline: Doc[] = [];
        for (const [index, child] of parts.entries()) {
            if (child === jsxWhitespace) {
                if (index === 1 && parts[0] === "") {
                    if (parts.length === 2) {
                        multiline.push(rawWhitespace);
                        continue;
                    }
                    multiline.push([rawWhitespace, hardline]);
                    continue;
                }
                if (
                    index === parts.length - 1 ||
                    (parts[index - 1] === "" && parts[index - 2] === hardline)
                ) {
                    multiline.push(rawWhitespace);
                    continue;
                }
            }
            multiline.push(child);
            if (willBreak(child)) forcedBreak = true;
        }

        const content = containsText
            ? fill(multiline)
            : group(multiline, { shouldBreak: true });
        const multilineElement = group([
            opening,
            indent([hardline, content]),
            hardline,
            closing,
        ]);
        if (forcedBreak) return multilineElement;
        return conditionalGroup([
            group([opening, ...parts, closing]),
            multilineElement,
        ]);
    }

    #children(children: Node[], jsxWhitespace: Doc): Doc[] {
        const parts: Doc[] = [];
        for (const [index, child] of children.entries()) {
            const next = children[index + 1];
            if (child.type === "JSXText") {
                const text = child.raw;
                if (this.#meaningful(child)) {
                    const words = text.split(jsxWhitespacePattern);
                    if (words[0] === "") {
                        parts.push("");
                        words.shift();
                        if (/\n/.test(words[0] ?? ""))
                            parts.push(
                                this.#separatorWithWhitespace(
                                    words[1] ?? "",
                                    child,
                                ),
                            );
                        else parts.push(jsxWhitespace);
                        words.shift();
                    }

                    let endWhitespace: string | undefined;
                    if (words.at(-1) === "") {
                        words.pop();
                        endWhitespace = words.pop();
                    }
                    if (words.length === 0) continue;

                    for (const [position, word] of words.entries())
                        parts.push(position % 2 === 1 ? line : word);

                    if (endWhitespace !== undefined) {
                        if (/\n/.test(endWhitespace))
                            parts.push(
                                this.#separatorWithWhitespace(
                                    words.at(-1) ?? "",
                                    child,
                                ),
                            );
                        else parts.push(jsxWhitespace);
                    } else
                        parts.push(
                            this.#separatorNoWhitespace(
                                words.at(-1) ?? "",
                                child,
                                next,
                            ),
                        );
                } else if (/\n/.test(text)) {
                    if (
                        (text.trim() === ""
                            ? (text.match(/\n/g)?.length ?? 0)
                            : 0) > 1
                    )
                        parts.push("", hardline);
                } else parts.push("", jsxWhitespace);
            } else {
                parts.push(this.print(child));
                if (next && this.#meaningful(next)) {
                    const firstWord =
                        (next as NodeOf<"JSXText">).raw
                            .replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g, "")
                            .split(jsxWhitespacePattern)[0] ?? "";
                    parts.push(
                        this.#separatorNoWhitespace(firstWord, child, next),
                    );
                } else parts.push(hardline);
            }
        }
        return parts;
    }

    #separatorNoWhitespace(
        word: string,
        child: Node,
        next: Node | undefined,
    ): Doc {
        if (
            (child.type === "JSXElement" && child.selfClosing) ||
            (next?.type === "JSXElement" && next.selfClosing)
        )
            return word.length === 1 ? softline : hardline;
        return softline;
    }

    #separatorWithWhitespace(word: string, child: Node): Doc {
        if (word.length === 1)
            return child.type === "JSXText" && !child.raw.includes("\n")
                ? hardline
                : softline;
        return hardline;
    }

    #meaningful(node: Node): boolean {
        if (node.type !== "JSXText") return false;
        return /[^\t\n\f\r ]/.test(node.raw) || !/\n/.test(node.raw);
    }

    #whitespaceExpression(node: Node): boolean {
        return (
            node.type === "JSXExpressionContainer" &&
            node.expression?.type === "StringLiteral" &&
            node.expression.raw.slice(1, -1) === " " &&
            !this.printer.hasComment(node.expression)
        );
    }

    #attribute(node: NodeOf<"JSXAttribute">): Doc {
        if (!node.value) return node.name;
        if (node.value.type !== "StringLiteral")
            return [node.name, "=", this.print(node.value)];

        const raw = node.value.raw;
        const content = raw
            .slice(1, -1)
            .replaceAll("&apos;", "'")
            .replaceAll("&quot;", '"');
        const preferred = this.options.jsxQuote;
        const alternate = preferred === '"' ? "'" : '"';
        const count = (char: string) => content.split(char).length - 1;
        const quote =
            count(preferred) > count(alternate) ? alternate : preferred;
        const escaped = content.replaceAll(
            quote,
            quote === '"' ? "&quot;" : "&apos;",
        );
        return [
            node.name,
            "=",
            this.printer.withComments(node.value, quote + escaped + quote),
        ];
    }

    #container(node: NodeOf<"JSXExpressionContainer">): Doc {
        const { expression } = node;
        if (!expression)
            return ["{", this.printer.dangling(node), lineSuffixBoundary, "}"];
        const parent = this.printer.parent();
        const inline =
            !this.printer.hasComment(expression) &&
            (expression.type === "ArrayExpression" ||
                expression.type === "ObjectExpression" ||
                expression.type === "ArrowFunctionExpression" ||
                expression.type === "CallExpression" ||
                expression.type === "FunctionExpression" ||
                expression.type === "TemplateLiteral" ||
                expression.type === "TaggedTemplateExpression" ||
                (Nodes.isJsx(parent) &&
                    (expression.type === "ConditionalExpression" ||
                        Nodes.isBinaryish(expression))));
        if (inline)
            return group([
                "{",
                this.print(expression),
                lineSuffixBoundary,
                "}",
            ]);
        return group([
            "{",
            indent([softline, this.print(expression)]),
            softline,
            lineSuffixBoundary,
            "}",
        ]);
    }
}
