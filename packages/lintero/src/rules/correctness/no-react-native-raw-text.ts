import type { Node } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

const containers = ["Text", "TSpan", "StyledText", "Animated.Text"];

export default rule<{ skip?: string[] }>({
    name: "noReactNativeRawText",
    group: "correctness",
    severity: "error",
    recommended: false,
    fix: "none",
    languages: ["jsx"],
    domains: { reactNative: "recommended" },
    options: { skip: [] },
    create: (context) => {
        const allowed = [...containers, ...(context.options.skip ?? [])];
        const inText = (node: Node) =>
            [...context.ancestors(node)].some(
                (ancestor) =>
                    ancestor.type === "JSXElement" &&
                    allowed.includes(ancestor.name ?? ""),
            );
        const report = (node: Node, text: string) => {
            if (inText(node)) return;
            context.report(
                node,
                text.trim() === ""
                    ? "Whitespace cannot be used outside of a <Text> tag."
                    : `Raw text (${text}) cannot be used outside of a <Text> tag.`,
            );
        };

        return {
            JSXText(node) {
                // line breaks between elements are not rendered
                if (node.raw.trim() === "" && node.raw.includes("\n")) return;
                report(node, node.raw);
            },
            JSXExpressionContainer(node) {
                const { expression } = node;
                if (context.parent(node)?.type !== "JSXElement") return;
                if (expression?.type === "StringLiteral")
                    report(node, expression.raw.slice(1, -1));
                else if (expression?.type === "TemplateLiteral") {
                    const [first] = expression.expressions;
                    if (inText(node)) return;
                    context.report(
                        node,
                        `Raw text (TemplateLiteral${first?.type === "Identifier" ? `: ${first.name}` : ""}) cannot be used outside of a <Text> tag.`,
                    );
                }
            },
        };
    },
});
