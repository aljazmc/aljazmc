import type { Node } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

const identifier = /^[\p{ID_Start}$_][\p{ID_Continue}$\u200c\u200d]*$/u;

export default rule({
    name: "useLiteralKeys",
    group: "complexity",
    severity: "info",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    create: (context) => {
        /** Replaces `object["key"]` with `object.key`, `object?.["key"]` with `object?.key`. */
        const literal = (key: Node, name: string) => {
            const open = context.text.lastIndexOf("[", key.start);
            const close = context.find("]", key.end);
            const optional = context.text
                .slice(0, open)
                .trimEnd()
                .endsWith("?.");
            return {
                start: optional
                    ? context.text.lastIndexOf("?.", open) + 2
                    : open,
                end: close.end,
                text: optional ? name : `.${name}`,
            };
        };
        const check = (key: Node, member?: Node) => {
            const value = Nodes.string(key);
            if (value === undefined) return;
            if (!member)
                context.report(
                    key,
                    "The computed expression can be simplified to a string literal.",
                );
            else if (identifier.test(value))
                context.report(
                    key,
                    "The computed expression can be simplified without the use of a string literal.",
                    member && {
                        message: "Use a literal key instead.",
                        edits: [literal(key, value)],
                    },
                );
        };
        return {
            MemberExpression(node) {
                if (node.computed) check(node.property, node);
            },
            Property(node) {
                if (
                    node.computed &&
                    context.parent(node)?.type === "ObjectExpression"
                )
                    check(node.key);
            },
            PropertyDefinition(node) {
                if (node.computed) check(node.key);
            },
            MethodDefinition(node) {
                if (node.computed) check(node.key);
            },
            TSPropertySignature(node) {
                if (node.computed) check(node.key);
            },
            TSMethodSignature(node) {
                if (node.computed) check(node.key);
            },
        };
    },
});
