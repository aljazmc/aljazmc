import type { Node } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

/** The name of an overloadable member, static class members apart. */
const nameOf = (member: Node): string | undefined => {
    if (member.type === "TSMethodSignature")
        return Nodes.key(member.key, member.computed);
    if (member.type === "MethodDefinition" && member.kind === "method") {
        const name = Nodes.key(member.key, member.computed);
        return name === undefined
            ? undefined
            : `${member.static ? "static " : ""}${name}`;
    }
};

export default rule({
    name: "useAdjacentOverloadSignatures",
    group: "suspicious",
    severity: "warn",
    recommended: true,
    fix: "none",
    languages: ["ts"],
    create: (context) => {
        const check = (members: Node[]) => {
            const seen = new Set<string>();
            let previous: string | undefined;
            for (const member of members) {
                const name = nameOf(member);
                if (name !== undefined && name !== previous && seen.has(name)) {
                    const key = (member as { key: Node }).key;
                    context.report(
                        key,
                        `All ${name.replace(/^static /, "")} signatures must be adjacent.`,
                    );
                }
                if (name !== undefined) seen.add(name);
                previous = name;
            }
        };
        return {
            TSInterfaceBody(node) {
                check(node.body);
            },
            TSTypeLiteral(node) {
                check(node.members);
            },
            ClassBody(node) {
                check(node.body);
            },
        };
    },
});
