import type { Node } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

const message = "innerText is not recommended for reading DOM node text.";

/** Types written so that they cannot hold a DOM node, like `string` or `{ innerText: string }`, named types are not resolved. */
const notDom = (type: Node): boolean => {
    switch (type.type) {
        case "TSParenthesizedType":
            return notDom(type.typeAnnotation);
        case "TSUnionType":
            return type.types.every(notDom);
        case "TSKeyword":
            return [
                "bigint",
                "boolean",
                "null",
                "number",
                "string",
                "symbol",
                "undefined",
            ].includes(type.name);
        case "TSArrayType":
        case "TSConstructorType":
        case "TSFunctionType":
        case "TSLiteralType":
        case "TSTemplateLiteralType":
        case "TSTupleType":
        case "TSTypeLiteral":
            return true;
        default:
            return false;
    }
};

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
        /** Whether the object is a parameter or variable declared with a type that is not a DOM node. */
        const typed = (object: Node): boolean => {
            if (object.type !== "Identifier") return false;
            const declaration =
                context.semantic.referenced(object)?.binding?.declarations[0];
            const id = declaration?.id;
            return (
                id?.type === "Identifier" &&
                !!id.typeAnnotation &&
                notDom(id.typeAnnotation)
            );
        };
        return {
            MemberExpression(node) {
                const { property } = node;
                if (typed(node.object)) return;
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
                // the type of a destructured parameter or variable
                if (node.typeAnnotation && notDom(node.typeAnnotation)) return;
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
