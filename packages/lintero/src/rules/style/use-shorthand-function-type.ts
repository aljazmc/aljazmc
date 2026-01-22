import type { Node } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

export default rule({
    name: "useShorthandFunctionType",
    group: "style",
    severity: "info",
    recommended: true,
    fix: "safe",
    languages: ["ts"],
    create: (context) => {
        const check = (members: Node[]) => {
            const [member] = members;
            if (
                members.length === 1 &&
                member?.type === "TSCallSignatureDeclaration" &&
                member.returnType
            )
                context.report(
                    member,
                    "Use a function type instead of a call signature.",
                );
        };
        return {
            TSInterfaceDeclaration(node) {
                if (node.extends.length === 0) check(node.body.body);
            },
            TSTypeLiteral(node) {
                check(node.members);
            },
        };
    },
});
