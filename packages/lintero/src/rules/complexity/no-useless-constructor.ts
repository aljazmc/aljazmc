import type { Node } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

/** Whether super arguments pass the parameters on unchanged. */
const forwards = (params: Node[], args: Node[]): boolean => {
    if (params.length !== args.length) return false;
    return params.every((param, index) => {
        const arg = args[index] as Node;
        if (param.type === "Identifier")
            return arg.type === "Identifier" && arg.name === param.name;
        return (
            param.type === "RestElement" &&
            param.argument.type === "Identifier" &&
            arg.type === "SpreadElement" &&
            arg.argument.type === "Identifier" &&
            arg.argument.name === param.argument.name
        );
    });
};

export default rule({
    name: "noUselessConstructor",
    group: "complexity",
    severity: "info",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    create: (context) => ({
        MethodDefinition(node) {
            if (node.kind !== "constructor" || !node.value.body) return;
            if (
                node.accessibility === "private" ||
                node.accessibility === "protected"
            )
                return;
            const { params, body } = node.value;
            if (params.some((param) => param.type === "TSParameterProperty"))
                return;
            const owner = context.parent(context.parent(node) as Node);
            if (
                !owner ||
                !("decorators" in owner) ||
                (owner.decorators as Node[]).length > 0
            )
                return;
            if (body.type !== "BlockStatement") return;
            if (node.decorators.length > 0) return;

            const superClass = "superClass" in owner && owner.superClass;
            let useless = false;
            if (!superClass) useless = body.body.length === 0;
            else {
                const [statement] = body.body;
                const call =
                    statement?.type === "ExpressionStatement"
                        ? statement.expression
                        : undefined;
                const args =
                    call?.type === "CallExpression" &&
                    call.callee.type === "Super"
                        ? call.arguments
                        : undefined;
                const typed =
                    context.language.typescript &&
                    args !== undefined &&
                    args.length > 0;
                const spreadsArguments =
                    args?.length === 1 &&
                    args[0]?.type === "SpreadElement" &&
                    args[0].argument.type === "Identifier" &&
                    args[0].argument.name === "arguments";
                useless =
                    body.body.length === 1 &&
                    args !== undefined &&
                    !typed &&
                    (forwards(params, args) || spreadsArguments);
            }
            if (useless)
                context.report(node, "This constructor is unnecessary.", {
                    message: "Remove the unnecessary constructor.",
                    edits: [{ start: node.start, end: node.end, text: "" }],
                });
        },
    }),
});
