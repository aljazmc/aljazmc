import type { Node } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

export default rule({
    name: "useExponentiationOperator",
    group: "style",
    severity: "info",
    recommended: true,
    fix: "safe",
    languages: ["js"],
    create: (context) => ({
        CallExpression(node) {
            const callee = Nodes.unwrap(node.callee);
            if (
                Nodes.path(callee) !== "Math.pow" ||
                callee.type !== "MemberExpression"
            )
                return;
            if (!context.semantic.isGlobal(Nodes.unwrap(callee.object))) return;
            const [base, exponent] = node.arguments as [Node?, Node?];
            const simple =
                node.arguments.length === 2 &&
                base &&
                exponent &&
                ![base, exponent].some((arg) => arg.type === "SpreadElement");
            context.report(
                node,
                "Use the '**' operator instead of 'Math.pow'.",
                simple
                    ? {
                          message:
                              "Use the '**' operator instead of 'Math.pow'.",
                          edits: [
                              {
                                  start: node.start,
                                  end: node.end,
                                  text: `(${context.slice(base)}) ** (${context.slice(exponent)})`,
                              },
                          ],
                      }
                    : undefined,
            );
        },
    }),
});
