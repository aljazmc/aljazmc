import type { Node } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noDuplicateObjectKeys",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "unsafe",
    languages: ["js", "json"],
    create: (context) => ({
        ObjectExpression(node) {
            const json = context.language.json;
            const seen = new Map<string, { node: Node; kind: string }[]>();

            for (const property of node.properties) {
                if (property.type !== "Property") continue;
                const name = Nodes.key(property.key, property.computed);
                if (name === undefined) continue;
                const entries = seen.get(name) ?? [];
                entries.push({ node: property, kind: property.kind });
                seen.set(name, entries);
            }

            for (const [name, entries] of seen) {
                if (entries.length < 2) continue;
                if (json) {
                    for (const entry of entries.slice(1))
                        context.report(
                            (entry.node as { key: Node }).key,
                            `The key ${name} was already declared.`,
                        );
                    continue;
                }
                // a getter and a setter pair is fine, the last of each overwrites the others
                for (const [index, entry] of entries.entries()) {
                    const later = entries.slice(index + 1);
                    const overwritten = later.some(
                        (other) =>
                            entry.kind === "init" ||
                            other.kind === "init" ||
                            other.kind === entry.kind,
                    );
                    if (!overwritten) continue;
                    const what =
                        entry.kind === "get"
                            ? "getter"
                            : entry.kind === "set"
                              ? "setter"
                              : "property";
                    context.report(
                        entry.node,
                        `This ${what} is later overwritten by an object member with the same name.`,
                    );
                }
            }
        },
    }),
});
