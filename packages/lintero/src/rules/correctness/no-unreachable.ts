import type { Node } from "@aljazmc/syntax";
import Flow from "../../analysis/flow.js";
import { rule } from "../../rules.js";

/** Declarations that are hoisted, or that only declare, run nothing when unreachable. */
const inert = (node: Node) =>
    node.type === "FunctionDeclaration" ||
    node.type === "EmptyStatement" ||
    node.type === "TSInterfaceDeclaration" ||
    node.type === "TSTypeAliasDeclaration" ||
    node.type === "TSDeclareFunction" ||
    (node.type === "VariableDeclaration" &&
        node.kind === "var" &&
        node.declarations.every((declarator) => !declarator.init));

export default rule({
    name: "noUnreachable",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => {
        const report = (range: { start: number; end: number }) =>
            context.report(range, "This code will never be reached ...");
        const list = (statements: readonly Node[]) => {
            for (const [index, statement] of statements.entries()) {
                if (Flow.completions(statement).has("normal")) continue;
                const rest = statements
                    .slice(index + 1)
                    .filter((other) => !inert(other));
                const [first] = rest;
                const last = rest.at(-1);
                if (first && last)
                    report({ start: first.start, end: last.end });
                return;
            }
        };
        return {
            Program: (node) => list(node.body),
            BlockStatement: (node) => list(node.body),
            StaticBlock: (node) => list(node.body),
            SwitchCase: (node) => list(node.consequent),
            ForStatement(node) {
                const body = Flow.completions(node.body);
                if (node.update && !body.has("normal") && !body.has("continue"))
                    report(node.update);
            },
        };
    },
});
