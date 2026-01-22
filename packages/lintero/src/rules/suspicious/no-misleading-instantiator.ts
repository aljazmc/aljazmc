import type { Node } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

/** Whether a type names the declaration it is in. */
const names = (type: Node | null, name: string | undefined): boolean =>
    type?.type === "TSTypeReference" &&
    type.typeName.type === "Identifier" &&
    type.typeName.name === name;

export default rule({
    name: "noMisleadingInstantiator",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["ts"],
    create: (context) => {
        /** A member with the `;` or `,` after it. */
        const member = (node: Node) => {
            const after = context.skip(node.end);
            return {
                start: node.start,
                end: /[;,]/.test(context.text[after] ?? "")
                    ? after + 1
                    : node.end,
            };
        };
        return {
            TSInterfaceDeclaration(node) {
                for (const signature of node.body.body)
                    if (
                        signature.type === "TSConstructSignatureDeclaration" &&
                        names(signature.returnType, node.id.name)
                    )
                        context.report(
                            member(signature),
                            "Don't use the new method in interfaces.",
                        );
            },
            TSTypeAliasDeclaration(node) {
                if (node.typeAnnotation.type !== "TSTypeLiteral") return;
                for (const signature of node.typeAnnotation.members)
                    if (
                        signature.type === "TSMethodSignature" &&
                        !signature.computed &&
                        signature.key.type === "Identifier" &&
                        signature.key.name === "constructor"
                    )
                        context.report(
                            member(signature),
                            "Don't use the constructor method in type aliases.",
                        );
            },
            ClassBody(node) {
                const owner = context.parent(node);
                const name =
                    owner?.type === "ClassDeclaration" ||
                    owner?.type === "ClassExpression"
                        ? owner.id?.name
                        : undefined;
                for (const method of node.body)
                    if (
                        method.type === "MethodDefinition" &&
                        !method.computed &&
                        method.key.type === "Identifier" &&
                        method.key.name === "new" &&
                        !method.value.body &&
                        names(method.value.returnType, name)
                    )
                        context.report(
                            method,
                            "Don't use the new method in classes.",
                        );
            },
        };
    },
});
