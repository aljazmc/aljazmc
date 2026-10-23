import type { Node } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

const components = [
    "Component",
    "PureComponent",
    "React.Component",
    "React.PureComponent",
];

export default rule({
    name: "noReactStringRefs",
    group: "suspicious",
    severity: "warn",
    recommended: false,
    fix: "none",
    languages: ["js", "jsx"],
    domains: { react: "recommended" },
    create: (context) => ({
        JSXAttribute(node) {
            if (node.name !== "ref" || !node.value) return;
            let value: Node | null = node.value;
            if (value.type === "JSXExpressionContainer")
                value = value.expression;
            if (
                value?.type === "StringLiteral" ||
                value?.type === "TemplateLiteral"
            )
                context.report(node.value, "String refs are deprecated.");
        },
        MemberExpression(node) {
            if (
                node.object.type !== "ThisExpression" ||
                Nodes.key(node.property, node.computed) !== "refs" ||
                node.computed
            )
                return;
            const inComponent = [...context.ancestors(node)].some(
                (ancestor) =>
                    (ancestor.type === "ClassDeclaration" ||
                        ancestor.type === "ClassExpression") &&
                    ancestor.superClass !== null &&
                    components.includes(Nodes.path(ancestor.superClass) ?? ""),
            );
            if (inComponent)
                context.report(node, "Using this.refs is deprecated.");
        },
    }),
});
