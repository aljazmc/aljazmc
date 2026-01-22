import type { Node } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

/** Children that render something, whitespace with line breaks and empty expressions do not. */
const meaningful = (children: Node[]): Node[] =>
    children.filter(
        (child) =>
            !(
                (child.type === "JSXText" &&
                    /^\s*$/.test(child.raw) &&
                    child.raw.includes("\n")) ||
                (child.type === "JSXExpressionContainer" && !child.expression)
            ),
    );

export default rule({
    name: "noUselessFragments",
    group: "complexity",
    severity: "info",
    recommended: true,
    fix: "none",
    languages: ["jsx"],
    create: (context) => ({
        JSXElement(node) {
            const fragment =
                node.name === null ||
                ((node.name === "Fragment" || node.name === "React.Fragment") &&
                    node.attributes.length === 0);
            if (!fragment) return;

            const parent = context.parent(node);
            const children = meaningful(node.children);
            const [only] = children;
            const useless =
                parent?.type === "JSXElement" ||
                children.length === 0 ||
                (children.length === 1 && only?.type === "JSXElement");
            if (useless) context.report(node, "This fragment is unnecessary.");
        },
    }),
});
