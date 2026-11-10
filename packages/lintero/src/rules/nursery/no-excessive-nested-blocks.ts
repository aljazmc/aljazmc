import type { Css, Node } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

/** JavaScript statements that nest a block, and their keywords. */
const keywords: Record<string, string> = {
    IfStatement: "if",
    SwitchStatement: "switch",
    TryStatement: "try",
    DoWhileStatement: "do",
    WhileStatement: "while",
    WithStatement: "with",
    ForStatement: "for",
    ForInStatement: "for",
    ForOfStatement: "for",
};

const message = "This block is nested too deeply.";

export default rule<{ max?: number; ignoreAtRules?: string[] }>({
    name: "noExcessiveNestedBlocks",
    group: "nursery",
    severity: "warn",
    recommended: false,
    fix: "none",
    languages: ["js", "css"],
    options: { max: 4, ignoreAtRules: [] },
    create: (context) => {
        const max = () => context.options.max ?? 4;

        /** The `if` of an `else if` continues the chain of its parent `if`, it adds no level. */
        const nests = (node: Node): boolean => {
            if (!(node.type in keywords)) return false;
            const parent = context.parent(node);
            return !(
                node.type === "IfStatement" &&
                parent?.type === "IfStatement" &&
                parent.alternate === node
            );
        };

        /**
         * Only the outermost statement deeper than `max` is reported, every
         * function and `static {}` block counts from zero again.
         */
        const statement = (node: Node) => {
            if (!nests(node)) return;
            let depth = 0;
            for (const ancestor of context.ancestors(node)) {
                if (
                    Nodes.isFunction(ancestor) ||
                    ancestor.type === "StaticBlock"
                )
                    break;
                if (nests(ancestor)) depth++;
            }
            if (depth !== max()) return;
            const keyword = keywords[node.type] as string;
            context.report(
                { start: node.start, end: node.start + keyword.length },
                message,
            );
        };

        const ignored = (node: Css.AtRule) =>
            (context.options.ignoreAtRules ?? []).some(
                (name) => name.toLowerCase() === node.keyword,
            );

        /** Whether the block of a rule or at-rule adds a level to the blocks in it. */
        const counts = (node: Css.Rule | Css.AtRule) =>
            node.type === "Rule" ||
            (context.cssParent(node)?.type !== "Stylesheet" && !ignored(node));

        /** The end of what introduces a block, before the whitespace and comments before its `{`. */
        const headerEnd = (block: Css.Block) => {
            const comments = context.css?.comments ?? [];
            let end = block.start;
            for (;;) {
                while (end > 0 && /\s/.test(context.text[end - 1] as string))
                    end--;
                const comment = comments.find((c) => c.end === end);
                if (!comment) return end;
                end = comment.start;
            }
        };

        /** Only the outermost block deeper than `max` is reported, top level at-rules add no level. */
        const block = (node: Css.Rule | Css.AtRule) => {
            if (!node.block || (node.type === "AtRule" && ignored(node)))
                return;
            let depth = 0;
            for (const ancestor of context.cssAncestors(node))
                if (counts(ancestor)) depth++;
            if (depth !== max() + 1) return;
            const end = headerEnd(node.block);
            context.report(
                end > node.start
                    ? { start: node.start, end }
                    : { start: node.block.start, end: node.block.start + 1 },
                message,
            );
        };

        return {
            ...Object.fromEntries(
                Object.keys(keywords).map((type) => [type, statement]),
            ),
            CssRule: block,
            CssAtRule: block,
        };
    },
});
