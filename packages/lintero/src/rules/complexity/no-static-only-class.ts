import type { Node } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

export default rule({
    name: "noStaticOnlyClass",
    group: "complexity",
    severity: "warn",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => {
        const check = (node: Node) => {
            if (
                node.type !== "ClassDeclaration" &&
                node.type !== "ClassExpression"
            )
                return;
            if (node.superClass || node.decorators.length > 0) return;
            const members = node.body.body.filter(
                (member) => member.type !== "TSIndexSignature",
            );
            if (members.length === 0) return;
            const statics = members.every(
                (member) =>
                    member.type === "StaticBlock" ||
                    ((member.type === "MethodDefinition" ||
                        member.type === "PropertyDefinition") &&
                        member.static &&
                        !member.accessibility?.startsWith("pri") &&
                        !(
                            member.type === "PropertyDefinition" &&
                            member.key.type === "PrivateName" &&
                            false
                        )),
            );
            if (statics)
                context.report(
                    node,
                    "Avoid classes that contain only static members.",
                );
        };
        return { ClassDeclaration: check, ClassExpression: check };
    },
});
