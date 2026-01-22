import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noDuplicateClassMembers",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        ClassBody(node) {
            const seen = new Map<string, string[]>();

            for (const member of node.body) {
                if (
                    member.type !== "MethodDefinition" &&
                    member.type !== "PropertyDefinition"
                )
                    continue;
                // overload signatures have no body
                if (member.type === "MethodDefinition" && !member.value.body)
                    continue;
                const name = Nodes.key(member.key, member.computed);
                if (name === undefined) continue;

                const key = `${member.static ? "static " : ""}${name}`;
                const kind =
                    member.type === "MethodDefinition" &&
                    (member.kind === "get" || member.kind === "set")
                        ? member.kind
                        : "value";
                const kinds = seen.get(key) ?? [];
                if (
                    kinds.includes("value") ||
                    kinds.includes(kind) ||
                    (kind === "value" && kinds.length > 0)
                )
                    context.report(
                        member,
                        `Duplicate class member name ${name}.`,
                    );
                seen.set(key, [...kinds, kind]);
            }
        },
    }),
});
