import type { Node } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

const deep = (
    source: Node | null | undefined,
): source is Node & { raw: string } =>
    source?.type === "StringLiteral" &&
    /^react-native\/./.test(source.raw.slice(1, -1));

export default rule({
    name: "noReactNativeDeepImports",
    group: "suspicious",
    severity: "error",
    recommended: false,
    fix: "none",
    languages: ["js"],
    domains: { reactNative: "recommended" },
    create: (context) => {
        const message = "Deep imports from react-native are not allowed.";
        const check = (source: Node | null | undefined) => {
            if (deep(source)) context.report(source, message);
        };
        return {
            ImportDeclaration(node) {
                check(node.source);
            },
            ExportNamedDeclaration(node) {
                check(node.source);
            },
            ExportAllDeclaration(node) {
                check(node.source);
            },
            ImportExpression(node) {
                check(node.source);
            },
            CallExpression(node) {
                if (
                    node.callee.type === "Identifier" &&
                    node.callee.name === "require"
                )
                    check(node.arguments[0]);
            },
        };
    },
});
