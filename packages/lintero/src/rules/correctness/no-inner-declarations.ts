import type { Node } from "@aljazmc/syntax";
import type Context from "../../analysis/context.js";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

/** Where a declaration belongs: a function, a static block or the file. */
const root = (context: Context, node: Node): string => {
    for (const ancestor of context.ancestors(node)) {
        if (
            Nodes.isFunction(ancestor) ||
            ancestor.type === "TSModuleDeclaration"
        )
            return "enclosing function";
        if (ancestor.type === "StaticBlock") return "static block";
    }
    return /\.c[jt]s$/.test(context.file) ? "script" : "module";
};

/** Whether a statement sits at the root of a function, static block, namespace or file. */
const atRoot = (context: Context, node: Node): boolean => {
    const parent = context.parent(node);
    switch (parent?.type) {
        case "Program":
        case "StaticBlock":
        case "TSModuleBlock":
            return true;
        case "ExportNamedDeclaration":
        case "ExportDefaultDeclaration":
            return atRoot(context, parent);
        case "BlockStatement":
            return Nodes.isFunction(context.parent(parent));
        default:
            return false;
    }
};

export default rule({
    name: "noInnerDeclarations",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => {
        const check = (node: Node, kind: string) => {
            if (!atRoot(context, node))
                context.report(
                    node,
                    `This ${kind} should be declared at the root of the ${root(context, node)}.`,
                );
        };
        return {
            VariableDeclaration(node) {
                if (node.kind !== "var" || node.declare) return;
                const parent = context.parent(node);
                // like Biome, `for (var ...)` is reported, for in and of are not
                if (parent?.type === "ForStatement") {
                    context.report(
                        node,
                        `This var should be declared at the root of the ${root(context, node)}.`,
                    );
                    return;
                }
                if (
                    parent?.type === "ForInStatement" ||
                    parent?.type === "ForOfStatement"
                )
                    return;
                check(node, "var");
            },
            FunctionDeclaration(node) {
                // function declarations are block scoped in modules
                if (!/\.c[jt]s$/.test(context.file)) return;
                check(node, "function");
            },
        };
    },
});
