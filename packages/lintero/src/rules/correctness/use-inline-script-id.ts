import Imports from "../../analysis/imports.js";
import React from "../../analysis/react.js";
import { rule } from "../../rules.js";

export default rule({
    name: "useInlineScriptId",
    group: "correctness",
    severity: "error",
    recommended: false,
    fix: "none",
    languages: ["jsx"],
    domains: { next: "recommended" },
    create: (context) => ({
        JSXElement(node) {
            if (Imports.of(context, node)?.source !== "next/script") return;
            const has = (name: string) =>
                node.attributes.some(
                    (attribute) =>
                        (attribute.type === "JSXAttribute" &&
                            attribute.name === name) ||
                        // like {...{ id: "a" }}
                        (attribute.type === "JSXSpreadAttribute" &&
                            attribute.argument.type === "ObjectExpression" &&
                            React.property(attribute.argument, name) !==
                                undefined),
                );
            if (
                (node.children.length > 0 || has("dangerouslySetInnerHTML")) &&
                !has("id")
            )
                context.report(
                    node,
                    "next/script components have inline content or `dangerouslySetInnerHTML` without id attribute.",
                );
        },
    }),
});
