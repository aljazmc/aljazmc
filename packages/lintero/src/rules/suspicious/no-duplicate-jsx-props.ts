import type { Node } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

export default rule({
    name: "noDuplicateJsxProps",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["jsx"],
    create: (context) => ({
        JSXElement(node) {
            const seen = new Map<string, Node>();
            const reported = new Set<Node>();
            for (const attribute of node.attributes) {
                if (attribute.type !== "JSXAttribute") continue;
                const first = seen.get(attribute.name);
                // reported once, at the first of the duplicates
                if (first && !reported.has(first)) {
                    context.report(
                        first,
                        "This JSX property is assigned multiple times.",
                    );
                    reported.add(first);
                }
                if (!first) seen.set(attribute.name, attribute);
            }
        },
    }),
});
