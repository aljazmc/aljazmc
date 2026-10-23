import type { Node } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

const message = "innerText is not recommended for reading DOM node text.";

export default rule({
    name: "useDomNodeTextContent",
    group: "performance",
    severity: "warn",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    create: (context) => {
        const replace = (node: Node, text: string) => ({
            message: "Use textContent instead.",
            edits: [{ start: node.start, end: node.end, text }],
        });
        return {
            MemberExpression(node) {
                const { property } = node;
                if (
                    !node.computed &&
                    property.type === "Identifier" &&
                    property.name === "innerText"
                )
                    context.report(
                        property,
                        message,
                        replace(property, "textContent"),
                    );
                else if (
                    node.computed &&
                    property.type === "StringLiteral" &&
                    Nodes.string(property) === "innerText"
                )
                    context.report(
                        property,
                        message,
                        replace(
                            property,
                            property.raw.replace("innerText", "textContent"),
                        ),
                    );
            },
            ObjectPattern(node) {
                // destructured in declarations and parameters, not in assignments
                for (const ancestor of context.ancestors(node)) {
                    if (ancestor.type === "AssignmentExpression") return;
                    if (
                        ancestor.type !== "ObjectPattern" &&
                        ancestor.type !== "ArrayPattern" &&
                        ancestor.type !== "Property" &&
                        ancestor.type !== "AssignmentPattern" &&
                        ancestor.type !== "RestElement"
                    )
                        break;
                }
                for (const property of node.properties)
                    if (
                        property.type === "Property" &&
                        Nodes.key(property.key, property.computed) ===
                            "innerText"
                    )
                        context.report(property.key, message);
            },
        };
    },
});
