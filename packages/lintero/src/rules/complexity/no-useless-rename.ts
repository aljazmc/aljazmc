import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noUselessRename",
    group: "complexity",
    severity: "info",
    recommended: true,
    fix: "safe",
    languages: ["js"],
    create: (context) => ({
        ImportSpecifier(node) {
            if (
                node.imported.start !== node.local.start &&
                Nodes.key(node.imported) === node.local.name
            )
                context.report(node, "Useless rename.", {
                    message: "Remove the renaming.",
                    edits: [
                        {
                            start: node.start,
                            end: node.end,
                            text: context.slice(node.local),
                        },
                    ],
                });
        },
        ExportSpecifier(node) {
            if (
                node.local.start !== node.exported.start &&
                Nodes.key(node.local) === Nodes.key(node.exported) &&
                node.local.type === node.exported.type
            )
                context.report(node, "Useless rename.", {
                    message: "Remove the renaming.",
                    edits: [
                        {
                            start: node.start,
                            end: node.end,
                            text: context.slice(node.local),
                        },
                    ],
                });
        },
        ObjectPattern(node) {
            for (const property of node.properties) {
                if (
                    property.type !== "Property" ||
                    property.shorthand ||
                    property.computed
                )
                    continue;
                const value =
                    property.value.type === "AssignmentPattern"
                        ? property.value.left
                        : property.value;
                if (
                    value.type === "Identifier" &&
                    Nodes.key(property.key) === value.name &&
                    property.key.type === "Identifier"
                )
                    context.report(property, "Useless rename.", {
                        message: "Remove the renaming.",
                        edits: [
                            {
                                start: property.key.start,
                                end: value.start,
                                text: "",
                            },
                        ],
                    });
            }
        },
    }),
});
