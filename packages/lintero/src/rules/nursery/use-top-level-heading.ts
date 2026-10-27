import type { Markdown } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

/** Comments that may precede the title, as HTML blocks or alone in a paragraph. */
const comment = (block: Markdown.Block): boolean =>
    (block.type === "HtmlBlock" &&
        block.kind === 2 &&
        block.lines.join("\n").trim().endsWith("-->")) ||
    (block.type === "Paragraph" &&
        block.text.startsWith("<!--") &&
        block.text.endsWith("-->"));

export default rule({
    name: "useTopLevelHeading",
    group: "nursery",
    severity: "info",
    recommended: false,
    fix: "none",
    languages: ["md"],
    create: (context) => ({
        Root(node) {
            const first = node.children.find((block) => !comment(block));
            // HTML may be the heading, like in many READMEs
            if (
                !first ||
                first.type === "ThematicBreak" ||
                first.type === "HtmlBlock" ||
                (first.type === "Heading" && first.level === 1)
            )
                return;
            context.report(first, "Missing top-level heading.");
        },
    }),
});
