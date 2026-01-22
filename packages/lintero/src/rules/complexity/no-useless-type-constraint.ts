import type { Node } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

export default rule({
    name: "noUselessTypeConstraint",
    group: "complexity",
    severity: "info",
    recommended: true,
    fix: "safe",
    languages: ["ts"],
    create: (context) => {
        const check = (
            name: string,
            start: number,
            constraint: Node | null,
        ) => {
            if (
                constraint?.type !== "TSKeyword" ||
                (constraint.name !== "any" && constraint.name !== "unknown")
            )
                return;
            const nameEnd = context.text.indexOf(name, start) + name.length;
            context.report(
                {
                    start: context.find("extends", nameEnd).start,
                    end: constraint.end,
                },
                "Constraining a type parameter to any or unknown is useless.",
                {
                    message: "Remove the constraint.",
                    edits: [{ start: nameEnd, end: constraint.end, text: "" }],
                },
            );
        };
        return {
            TSTypeParameter(node) {
                check(node.name, node.start, node.constraint);
            },
            TSInferType(node) {
                check(
                    node.name,
                    context.find("infer", node.start).end,
                    node.constraint,
                );
            },
        };
    },
});
