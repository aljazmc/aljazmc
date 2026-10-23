import type { Node } from "@aljazmc/syntax";
import Tests from "../../analysis/tests.js";
import { rule } from "../../rules.js";

const exports = [
    "ExportAllDeclaration",
    "ExportDefaultDeclaration",
    "ExportNamedDeclaration",
    "TSExportAssignment",
    "TSNamespaceExportDeclaration",
];

/** `module.exports`, not in parentheses. */
const isModuleExports = (node: Node): boolean =>
    node.type === "MemberExpression" &&
    !node.parenthesized &&
    !node.computed &&
    node.object.type === "Identifier" &&
    node.object.name === "module" &&
    node.property.type === "Identifier" &&
    node.property.name === "exports";

export default rule({
    name: "noExportsInTest",
    group: "suspicious",
    severity: "error",
    recommended: false,
    fix: "none",
    languages: ["js"],
    domains: { test: "recommended" },
    create: (context) => {
        const found: Node[] = [];
        return {
            "*"(node) {
                if (
                    exports.includes(node.type) ||
                    (node.type === "TSImportEqualsDeclaration" &&
                        context.text.startsWith("export", node.start))
                )
                    found.push(node);
            },
            AssignmentExpression(node) {
                const { left } = node;
                // module.exports = ..., module.exports.name = ...
                if (
                    isModuleExports(left) ||
                    (left.type === "MemberExpression" &&
                        isModuleExports(left.object))
                )
                    found.push(node);
            },
            "Program:exit"(program) {
                // a test file declares tests at its top level
                const tests = program.body.some(
                    (statement) =>
                        statement.type === "ExpressionStatement" &&
                        statement.expression.type === "CallExpression" &&
                        Tests.declares(statement.expression),
                );
                if (tests)
                    for (const node of found)
                        context.report(node, "Do not export from a test file.");
            },
        };
    },
});
