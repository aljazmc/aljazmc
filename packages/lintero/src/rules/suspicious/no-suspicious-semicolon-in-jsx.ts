import { rule } from "../../rules.js";

export default rule({
    name: "noSuspiciousSemicolonInJsx",
    group: "suspicious",
    severity: "warn",
    recommended: true,
    fix: "none",
    languages: ["jsx"],
    create: (context) => ({
        JSXElement(node) {
            for (const [index, child] of node.children.entries()) {
                const previous = node.children[index - 1];
                if (
                    child.type === "JSXText" &&
                    previous?.type === "JSXElement" &&
                    /^;[^\S\n]*\n\s*$/.test(child.raw)
                )
                    context.report(
                        child,
                        "There is a suspicious semicolon in the JSX element.",
                    );
            }
        },
    }),
});
