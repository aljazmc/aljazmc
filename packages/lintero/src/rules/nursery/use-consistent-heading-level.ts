import type { Markdown } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

export default rule({
    name: "useConsistentHeadingLevel",
    group: "nursery",
    severity: "info",
    recommended: true,
    fix: "none",
    languages: ["md"],
    create: (context) => {
        /** Compares each `#` heading with the next one among its siblings, setext ones are skipped. */
        const check = (blocks: Markdown.Block[]) => {
            const headings = blocks.filter(
                (block): block is Markdown.Heading =>
                    block.type === "Heading" && !block.setext,
            );
            for (const [index, heading] of headings.entries()) {
                const next = headings[index + 1];
                if (next && next.level > heading.level + 1)
                    context.report(next, "This heading skipped a level.");
            }
        };
        return {
            Root: (node) => check(node.children),
            BlockQuote: (node) => check(node.children),
            ListItem: (node) => check(node.children),
        };
    },
});
