import type { Node } from "@aljazmc/syntax";
import type Context from "./context.js";
import Nodes from "./nodes.js";

/** Helpers for functions and the names React gives them. */
// biome-ignore lint/complexity/noStaticOnlyClass: groups function helpers
export default class Functions {
    /** Whether a name is a component's, like `Button`. */
    static component(name: string): boolean {
        return /^\p{Lu}/u.test(name);
    }

    /** Whether a name is a hook's, like `useState`. */
    static hook(name: string): boolean {
        return /^use\p{Lu}/u.test(name);
    }

    /** Whether a function is a class or object method, a getter, a setter or a constructor. */
    static method(context: Context, node: Node): boolean {
        const parent = context.parent(node);
        return (
            parent?.type === "MethodDefinition" ||
            (parent?.type === "Property" &&
                parent.value === node &&
                (parent.method || parent.kind !== "init"))
        );
    }

    /**
     * The name a function is known by: its own for declarations, the variable,
     * property or assignment target for expressions, also through `memo(...)`.
     */
    static name(context: Context, node: Node): string | undefined {
        if (node.type === "FunctionDeclaration") return node.id?.name;
        let current = node;
        let parent = context.parent(current);
        if (
            parent?.type === "CallExpression" &&
            ["memo", "forwardRef", "React.memo", "React.forwardRef"].includes(
                Nodes.path(parent.callee) ?? "",
            )
        ) {
            current = parent;
            parent = context.parent(current);
        }
        if (parent?.type === "VariableDeclarator" && parent.init === current)
            return parent.id.type === "Identifier" ? parent.id.name : undefined;
        if (parent?.type === "AssignmentExpression" && parent.right === current)
            return parent.left.type === "Identifier"
                ? parent.left.name
                : Nodes.member(parent.left)?.name;
        if (
            (parent?.type === "Property" ||
                parent?.type === "PropertyDefinition") &&
            parent.value === current
        )
            return Nodes.key(parent.key, parent.computed);
    }

    /** Whether a function is a component or a hook by its name. */
    static componentOrHook(context: Context, node: Node): boolean {
        const name = Functions.name(context, node);
        return (
            name !== undefined &&
            (Functions.component(name) || Functions.hook(name))
        );
    }

    /** The closest function around a node. */
    static enclosing(context: Context, node: Node): Node | undefined {
        for (const ancestor of context.ancestors(node))
            if (Nodes.isFunction(ancestor)) return ancestor;
    }
}
