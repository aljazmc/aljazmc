import type { Node, NodeOf } from "@aljazmc/syntax";
import { Walker } from "@aljazmc/syntax";
import type Context from "../../analysis/context.js";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

type Member = NodeOf<"MethodDefinition"> | NodeOf<"PropertyDefinition">;

/** Whether a member access only writes its value, like `this.#a = 1`. */
const writeOnly = (context: Context, access: Node): boolean => {
    const parent = context.parent(access);
    return (
        parent?.type === "AssignmentExpression" &&
        parent.operator === "=" &&
        parent.left === access
    );
};

/** Names a class reads: `#private` ones anywhere, others only through `this`. */
const reads = (
    context: Context,
    node: Node,
    names: { private: Set<string>; public: Set<string>; dynamic: boolean },
): void => {
    for (const child of Walker.children(node)) {
        if (child.type === "MemberExpression") {
            const name = Nodes.key(child.property, child.computed);
            if (name === undefined) {
                if (child.object.type === "ThisExpression")
                    names.dynamic = true;
            } else if (!writeOnly(context, child)) {
                if (name.startsWith("#")) names.private.add(name);
                else if (child.object.type === "ThisExpression")
                    names.public.add(name);
            }
        } else if (
            child.type === "BinaryExpression" &&
            child.operator === "in" &&
            child.left.type === "PrivateName"
        )
            names.private.add(`#${child.left.name}`);
        else if (
            child.type === "ObjectPattern" &&
            context.parent(child)?.type === "VariableDeclarator"
        ) {
            const declarator = context.parent(child);
            if (
                declarator?.type === "VariableDeclarator" &&
                declarator.init?.type === "ThisExpression"
            )
                names.dynamic = true;
        }
        reads(context, child, names);
    }
};

export default rule({
    name: "noUnusedPrivateClassMembers",
    group: "correctness",
    severity: "warn",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    create: (context) => ({
        ClassBody(node) {
            // declarations only describe members implemented elsewhere
            const owner = context.parent(node);
            if (
                /\.d\.[cm]?ts$/.test(context.file) ||
                (owner?.type === "ClassDeclaration" && owner.declare)
            )
                return;
            const names = {
                private: new Set<string>(),
                public: new Set<string>(),
                dynamic: false,
            };
            reads(context, node, names);

            for (const member of node.body as Member[]) {
                if (
                    member.type !== "MethodDefinition" &&
                    member.type !== "PropertyDefinition"
                )
                    continue;
                if (
                    member.type === "MethodDefinition" &&
                    member.kind === "constructor"
                )
                    continue;
                const name = Nodes.key(member.key, member.computed);
                if (name === undefined) continue;

                const unused = name.startsWith("#")
                    ? !names.private.has(name)
                    : member.accessibility === "private" &&
                      !names.dynamic &&
                      !names.public.has(name);
                if (!unused) continue;
                // the member with the line break and indentation before it
                const before = context.text.lastIndexOf("\n", member.start - 1);
                const start =
                    before >= node.start &&
                    context.text.slice(before, member.start).trim() === ""
                        ? before
                        : member.start;
                context.report(
                    member.key,
                    "This private class member is defined but never used.",
                    {
                        message: "Remove unused declaration.",
                        edits: [{ start, end: member.end, text: "" }],
                    },
                );
            }
        },
    }),
});
