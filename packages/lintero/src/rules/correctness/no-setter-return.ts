import type { Node } from "@aljazmc/syntax";
import { rule } from "../../rules.js";
import { returns } from "./no-constructor-return.js";

export default rule({
    name: "noSetterReturn",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => {
        const check = (fn: Node) => {
            if (fn.type !== "FunctionExpression" || !fn.body) return;
            for (const statement of returns(fn.body))
                if (statement.type === "ReturnStatement" && statement.argument)
                    context.report(
                        statement,
                        "The setter should not return a value.",
                    );
        };
        return {
            MethodDefinition(node) {
                if (node.kind === "set") check(node.value);
            },
            Property(node) {
                if (node.kind === "set") check(node.value);
            },
        };
    },
});
