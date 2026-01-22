import type { Node } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

export default rule({
    name: "noThisInStatic",
    group: "complexity",
    severity: "warn",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    create: (context) => {
        /** The class a static member around a node belongs to, if any. */
        const staticClass = (node: Node): Node | undefined => {
            let child = node;
            for (const ancestor of context.ancestors(node)) {
                if (
                    ancestor.type === "FunctionDeclaration" ||
                    ancestor.type === "FunctionExpression"
                ) {
                    const member = context.parent(ancestor);
                    if (
                        member?.type !== "MethodDefinition" ||
                        member.value !== ancestor
                    )
                        return;
                    if (!member.static) return;
                    child = member;
                    continue;
                }
                if (
                    ancestor.type === "PropertyDefinition" &&
                    ancestor.value === child
                ) {
                    if (!ancestor.static) return;
                } else if (ancestor.type === "StaticBlock") {
                    child = ancestor;
                    continue;
                } else if (ancestor.type === "ClassBody") {
                    if (
                        child.type === "MethodDefinition" ||
                        child.type === "PropertyDefinition" ||
                        child.type === "StaticBlock"
                    )
                        return child.type === "StaticBlock" ||
                            ("static" in child && child.static)
                            ? context.parent(ancestor)
                            : undefined;
                    return;
                }
                child = ancestor;
            }
        };
        const check = (node: Node, keyword: string) => {
            const owner = staticClass(node);
            if (!owner) return;
            const name =
                "id" in owner && owner.id && owner.id.type === "Identifier"
                    ? owner.id.name
                    : undefined;
            const parent = context.parent(node);
            // super() calls only exist in constructors
            if (keyword === "super" && parent?.type === "CallExpression")
                return;
            context.report(
                node,
                `Using ${keyword} in a static context can be confusing.`,
                name && keyword === "this"
                    ? {
                          message: "Use the class name instead.",
                          edits: [
                              { start: node.start, end: node.end, text: name },
                          ],
                      }
                    : undefined,
            );
        };
        return {
            ThisExpression: (node) => check(node, "this"),
            Super: (node) => check(node, "super"),
        };
    },
});
