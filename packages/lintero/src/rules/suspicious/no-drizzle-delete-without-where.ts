import type { Node } from "@aljazmc/syntax";
import type Context from "../../analysis/context.js";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

/** Reports `db.<method>(...)` calls on Drizzle objects not followed by `.where(...)`. */
export const withoutWhere = (
    context: Context<{ drizzleObjectName?: string[] }>,
    node: Node,
    method: string,
    message: string,
) => {
    if (node.type !== "CallExpression") return;
    const member = Nodes.member(node.callee);
    if (
        node.callee.type !== "MemberExpression" ||
        node.callee.computed ||
        member?.name !== method ||
        member.object.type !== "Identifier" ||
        !(context.options.drizzleObjectName ?? []).includes(member.object.name)
    )
        return;
    // the chain after the call, like .set(...).where(...)
    for (let current: Node = node; ; ) {
        const parent = context.parent(current);
        if (parent?.type !== "MemberExpression" || parent.object !== current)
            break;
        const call = context.parent(parent);
        if (call?.type !== "CallExpression" || call.callee !== parent) break;
        if (Nodes.key(parent.property, parent.computed) === "where") return;
        current = call;
    }
    context.report(node, message);
};

export default rule<{ drizzleObjectName?: string[] }>({
    name: "noDrizzleDeleteWithoutWhere",
    group: "suspicious",
    severity: "error",
    recommended: false,
    fix: "none",
    languages: ["js"],
    domains: { drizzle: "recommended" },
    options: { drizzleObjectName: [] },
    create: (context) => ({
        CallExpression(node) {
            withoutWhere(
                context,
                node,
                "delete",
                ".delete() is used without .where(). This will delete all rows in the table.",
            );
        },
    }),
});
