import type { Node } from "@aljazmc/syntax";
import Imports from "../../analysis/imports.js";
import { rule } from "../../rules.js";

const functions = ["routeLoader$", "routeAction$"];

/** Whether a file is a route boundary, an index, layout or plugin file in `src/routes`. */
const boundary = (file: string): boolean => {
    const segments = Imports.segments(file);
    const routes = segments.findIndex(
        (segment, index) =>
            segment === "routes" && segments[index - 1] === "src",
    );
    const name = segments.at(-1) ?? "";
    return (
        routes >= 0 &&
        routes < segments.length - 1 &&
        /^(index|layout|plugin)/.test(name)
    );
};

export default rule({
    name: "useQwikLoaderLocation",
    group: "correctness",
    severity: "error",
    recommended: false,
    fix: "none",
    languages: ["js"],
    domains: { qwik: "recommended" },
    create: (context) => ({
        CallExpression(node) {
            const { callee } = node;
            if (
                callee.type !== "Identifier" ||
                !functions.includes(callee.name)
            )
                return;
            const name = callee.name;
            if (!boundary(context.file)) {
                context.report(
                    node,
                    `The route function ${name}() has been declared outside of the route boundaries.`,
                );
                return;
            }
            const declarator = context.parent(node);
            const id: Node | undefined =
                declarator?.type === "VariableDeclarator" &&
                declarator.init === node
                    ? declarator.id
                    : undefined;
            if (id?.type !== "Identifier") {
                context.report(
                    node,
                    `The loader function ${name}() is not being exported.`,
                );
                return;
            }
            const binding = context.semantic.declared(id);
            const exported =
                binding?.exported ||
                context.parent(context.parent(declarator as Node) as Node)
                    ?.type === "ExportNamedDeclaration";
            if (!exported)
                context.report(
                    id,
                    `The loader function ${name}() is not being exported.`,
                );
            else if (!id.name.startsWith("use"))
                context.report(
                    id,
                    `The exported name of ${name}() must follow the use* naming convention.`,
                );
        },
    }),
});
