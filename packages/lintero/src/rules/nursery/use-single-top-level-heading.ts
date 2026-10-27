import type { Markdown } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

/** HTML blocks that are only a comment, like `<!-- TODO -->`. */
const comment = (block: Markdown.Block): boolean =>
    block.type === "HtmlBlock" &&
    block.kind === 2 &&
    block.lines.join("\n").trim().endsWith("-->");

export default rule<{ level?: number }>({
    name: "useSingleTopLevelHeading",
    group: "nursery",
    severity: "info",
    recommended: true,
    fix: "none",
    languages: ["md"],
    options: { level: 1 },
    create: (context) => ({
        Root(node) {
            // front matter may hold the title already
            if (node.frontmatter) return;
            const level = context.options.level ?? 1;
            // only a heading at the start, after comments, is the title
            const title = node.children.find((block) => !comment(block));
            if (title?.type !== "Heading" || title.level !== level) return;
            for (const block of node.children)
                if (
                    block.type === "Heading" &&
                    block.level === level &&
                    block !== title
                )
                    context.report(
                        block,
                        "This document has more than one top-level heading.",
                    );
        },
    }),
});
