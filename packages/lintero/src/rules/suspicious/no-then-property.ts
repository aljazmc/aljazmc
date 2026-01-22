import type { Node } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

const then = (key: Node, computed: boolean) =>
    Nodes.key(key, computed) === "then";

export default rule({
    name: "noThenProperty",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => {
        const object = (node: Node) =>
            context.report(node, "This object defines a then property.");
        return {
            Property(node) {
                const parent = context.parent(node);
                if (
                    parent?.type === "ObjectExpression" &&
                    then(node.key, node.computed)
                )
                    object(node.key);
            },
            MethodDefinition(node) {
                if (then(node.key, node.computed))
                    context.report(
                        node.key,
                        "This class defines a then member.",
                    );
            },
            PropertyDefinition(node) {
                if (then(node.key, node.computed))
                    context.report(
                        node.key,
                        "This class defines a then member.",
                    );
            },
            ExportSpecifier(node) {
                if (Nodes.key(node.exported) === "then")
                    context.report(
                        node.exported,
                        "This export exposes the name then.",
                    );
            },
            ExportNamedDeclaration(node) {
                const declaration = node.declaration;
                if (!declaration) return;
                const ids: Node[] = [];
                if (declaration.type === "VariableDeclaration")
                    for (const declarator of declaration.declarations)
                        ids.push(declarator.id);
                else if ("id" in declaration && declaration.id)
                    ids.push(declaration.id);
                for (const id of ids)
                    if (id.type === "Identifier" && id.name === "then")
                        context.report(
                            id,
                            "This export exposes the name then.",
                        );
            },
            AssignmentExpression(node) {
                const left = Nodes.unwrap(node.left);
                if (
                    left.type === "MemberExpression" &&
                    then(left.property, left.computed)
                )
                    object(left);
            },
            CallExpression(node) {
                const path = Nodes.path(node.callee);
                const [, key, descriptor] = node.arguments;
                if (
                    (path === "Object.defineProperty" ||
                        path === "Reflect.defineProperty") &&
                    key &&
                    descriptor &&
                    Nodes.string(key) === "then"
                )
                    object(key);
            },
        };
    },
});
