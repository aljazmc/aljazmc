import type { Node } from "@aljazmc/syntax";
import type { Binding } from "../../analysis/semantic.js";
import { rule } from "../../rules.js";

export default rule({
    name: "useConst",
    group: "style",
    severity: "warn",
    recommended: true,
    fix: "safe",
    languages: ["js"],
    create: (context) => {
        const declarations: Node[] = [];
        return {
            VariableDeclaration(node) {
                if (node.kind === "let" && !node.declare)
                    declarations.push(node);
            },
            "Program:exit"() {
                const { semantic } = context;
                /** Whether a let binding is assigned once, by its initializer or a single later assignment. */
                const once = (binding: Binding, declarator: Node): boolean => {
                    const writes = binding.references.filter(
                        (reference) => reference.write,
                    );
                    const loop = context.parent(
                        context.parent(declarator) as Node,
                    );
                    const head =
                        (loop?.type === "ForInStatement" ||
                            loop?.type === "ForOfStatement") &&
                        loop.left === context.parent(declarator);
                    if (declarator.type !== "VariableDeclarator") return false;
                    if (declarator.init || head) return writes.length === 0;

                    const [write] = writes;
                    if (writes.length !== 1 || !write) return false;
                    const writer = write.writer;
                    if (
                        writer?.type !== "AssignmentExpression" ||
                        writer.operator !== "=" ||
                        writer.left.type !== "Identifier" ||
                        context.parent(writer)?.type !==
                            "ExpressionStatement" ||
                        // the assignment is a statement beside the declaration
                        context.parent(context.parent(writer) as Node) !==
                            context.parent(
                                context.parent(declarator) as Node,
                            ) ||
                        write.scope !== binding.scope
                    )
                        return false;
                    return !binding.references.some(
                        (reference) =>
                            !reference.write && reference.start < write.start,
                    );
                };

                for (const declaration of declarations) {
                    if (declaration.type !== "VariableDeclaration") continue;
                    const bindings = declaration.declarations.flatMap(
                        (declarator) => {
                            const ids: Node[] = [];
                            collect(declarator.id, ids);
                            return ids.map((id) => ({
                                binding: semantic.declared(id),
                                declarator,
                            }));
                        },
                    );
                    if (
                        bindings.length === 0 ||
                        !bindings.every(
                            ({ binding, declarator }) =>
                                binding && once(binding, declarator),
                        )
                    )
                        continue;

                    const keyword = {
                        start: declaration.start,
                        end: declaration.start + 3,
                    };
                    const initialized = declaration.declarations.every(
                        (declarator) => {
                            const loop = context.parent(declaration);
                            return (
                                declarator.init ||
                                loop?.type === "ForInStatement" ||
                                loop?.type === "ForOfStatement"
                            );
                        },
                    );
                    context.report(
                        keyword,
                        bindings.length === 1
                            ? "This let declares a variable that is only assigned once."
                            : "This let declares some variables that are only assigned once.",
                        initialized
                            ? {
                                  message: "Use const instead.",
                                  edits: [{ ...keyword, text: "const" }],
                              }
                            : undefined,
                    );
                }
            },
        };
    },
});

function collect(pattern: Node, ids: Node[]): void {
    switch (pattern.type) {
        case "Identifier":
            ids.push(pattern);
            return;
        case "ObjectPattern":
            for (const property of pattern.properties)
                collect(
                    property.type === "Property" ? property.value : property,
                    ids,
                );
            return;
        case "ArrayPattern":
            for (const element of pattern.elements)
                if (element) collect(element, ids);
            return;
        case "AssignmentPattern":
            collect(pattern.left, ids);
            return;
        case "RestElement":
            collect(pattern.argument, ids);
    }
}
