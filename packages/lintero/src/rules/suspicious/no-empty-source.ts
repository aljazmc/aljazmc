import type { Markdown, Node } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

const message = "An empty source is not allowed.";

/** Statements that do nothing, like `;` and `{}`. */
const empty = (node: Node): boolean =>
    node.type === "EmptyStatement" ||
    (node.type === "BlockStatement" && node.body.length === 0);

/** HTML blocks that are only a comment, like `<!-- TODO -->`. */
const comment = (block: Markdown.Block): boolean =>
    block.type === "HtmlBlock" &&
    block.kind === 2 &&
    block.lines.join("\n").trim().endsWith("-->");

export default rule<{ allowComments?: boolean }>({
    name: "noEmptySource",
    group: "suspicious",
    severity: "warn",
    recommended: false,
    fix: "none",
    languages: ["js", "md"],
    options: { allowComments: false },
    create: (context) => ({
        Program(node) {
            // like Biome, scripts are never empty
            const script =
                /\.cjs$/.test(context.file) ||
                (/\.jsx?$/.test(context.file) &&
                    context.manifest.type === "commonjs");
            if (script || !node.body.every(empty)) return;
            if (context.options.allowComments && context.comments.length > 0)
                return;
            const start = context.skip(0);
            context.report({ start, end: start }, message);
        },
        Root(node) {
            // front matter is content, and comments are when allowed
            if (node.frontmatter || !node.children.every(comment)) return;
            if (context.options.allowComments && node.children.length > 0)
                return;
            // like Biome, at the first token, after the comments
            const start =
                /^(?:[ \t]*<!--[\s\S]*?-->)*/.exec(context.text)?.[0].length ??
                0;
            context.report({ start, end: node.end }, message);
        },
    }),
});
