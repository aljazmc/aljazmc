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
    fix: "unsafe",
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
            if (!useless) return;
            const first = children[0];
            const last = children.at(-1);
            // the children in place of the fragment, nothing in other children
            const text =
                first && last
                    ? context.slice({ start: first.start, end: last.end })
                    : parent?.type === "JSXElement"
                      ? ""
                      : undefined;
            context.report(
                node,
                "This fragment is unnecessary.",
                text === undefined ||
                    (parent?.type !== "JSXElement" &&
                        first?.type !== "JSXElement")
                    ? undefined
                    : {
                          message: "Remove the Fragment",
                          edits: [{ start: node.start, end: node.end, text }],
                      },
            );
        },
    }),
});
