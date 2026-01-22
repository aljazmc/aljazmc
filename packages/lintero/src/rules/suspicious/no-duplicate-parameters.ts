import type { Node } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

const names = (pattern: Node, found: Node[]): void => {
    switch (pattern.type) {
        case "Identifier":
            found.push(pattern);
            return;
        case "ObjectPattern":
            for (const property of pattern.properties)
                names(
                    property.type === "Property" ? property.value : property,
                    found,
                );
            return;
        case "ArrayPattern":
            for (const element of pattern.elements)
                if (element) names(element, found);
            return;
        case "AssignmentPattern":
            names(pattern.left, found);
            return;
        case "RestElement":
            names(pattern.argument, found);
            return;
        case "TSParameterProperty":
            names(pattern.parameter, found);
    }
};

export default rule({
    name: "noDuplicateParameters",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => {
        const check = (params: Node[]) => {
            const found: Node[] = [];
            for (const param of params) names(param, found);
            const seen = new Set<string>();
            for (const id of found) {
                if (id.type !== "Identifier") continue;
                if (seen.has(id.name) && id.name !== "this")
                    context.report(id, "Duplicate parameter name.");
                seen.add(id.name);
            }
        };
        return {
            FunctionDeclaration: (node) => check(node.params),
            FunctionExpression: (node) => check(node.params),
            ArrowFunctionExpression: (node) => check(node.params),
        };
    },
});
