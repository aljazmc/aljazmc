import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noDuplicateEnumValues",
    group: "suspicious",
    severity: "warn",
    recommended: true,
    fix: "none",
    languages: ["ts"],
    create: (context) => ({
        TSEnumDeclaration(node) {
            const seen = new Set<string>();
            for (const member of node.members) {
                const value =
                    member.initializer && Nodes.unwrap(member.initializer);
                const key =
                    value?.type === "NumericLiteral"
                        ? `number:${Nodes.number(value.raw)}`
                        : value?.type === "StringLiteral"
                          ? `string:${Nodes.string(value)}`
                          : undefined;
                if (key === undefined) continue;
                // like Biome, only the first duplicate of an enum
                if (seen.has(key))
                    return context.report(
                        member,
                        "Duplicate enum member value.",
                    );
                seen.add(key);
            }
        },
    }),
});
