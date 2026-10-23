import type { Node } from "@aljazmc/syntax";
import Functions from "../../analysis/functions.js";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

const useServer = (directives: Node[]): boolean =>
    directives.some(
        (directive) =>
            directive.type === "Directive" &&
            directive.value.raw.slice(1, -1) === "use server",
    );

export default rule({
    name: "useReactAsyncServerFunction",
    group: "correctness",
    severity: "error",
    recommended: false,
    fix: "unsafe",
    languages: ["js"],
    domains: { react: "recommended" },
    create: (context) => {
        const reported = new Set<Node>();
        const report = (fn: Node | null | undefined) => {
            if (
                (fn?.type !== "FunctionDeclaration" &&
                    fn?.type !== "FunctionExpression" &&
                    fn?.type !== "ArrowFunctionExpression") ||
                fn.async ||
                fn.generator ||
                reported.has(fn)
            )
                return;
            reported.add(fn);
            // methods start at their name
            const start = Functions.method(context, fn)
                ? (context.parent(fn) as Node).start
                : fn.start;
            const asyncStart =
                fn.type === "ArrowFunctionExpression" ? fn.start : start;
            context.report(
                { start, end: fn.end },
                "This server function is missing the async keyword.",
                {
                    message: "Add async keyword.",
                    edits: [
                        { start: asyncStart, end: asyncStart, text: "async " },
                    ],
                },
            );
        };

        /** The functions a local name declares, for `export { name }` and `export default name`. */
        const declared = (id: Node) => {
            const binding = context.semantic.lookup(
                Nodes.key(id) ?? "",
                context.semantic.scopeAt(id.start),
            );
            for (const declaration of binding?.declarations ?? [])
                report(
                    declaration.node.type === "VariableDeclarator"
                        ? declaration.node.init
                        : declaration.node,
                );
        };

        return {
            Program(program) {
                const [first] = program.directives;
                if (!first || !useServer([first])) return;
                for (const statement of program.body) {
                    if (statement.type === "ExportDefaultDeclaration") {
                        const { declaration } = statement;
                        if (declaration.type === "Identifier")
                            declared(declaration);
                        else report(declaration);
                    }
                    if (statement.type !== "ExportNamedDeclaration") continue;
                    const { declaration } = statement;
                    if (declaration?.type === "VariableDeclaration")
                        for (const declarator of declaration.declarations)
                            if (declarator.type === "VariableDeclarator")
                                report(declarator.init);
                    report(declaration);
                    if (!statement.source)
                        for (const specifier of statement.specifiers)
                            if (specifier.type === "ExportSpecifier")
                                declared(specifier.local);
                }
            },
            BlockStatement(node) {
                const fn = context.parent(node);
                if (fn && Nodes.isFunction(fn) && useServer(node.directives))
                    report(fn);
            },
        };
    },
});
