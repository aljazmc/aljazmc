import type { Node } from "./ast.js";

/** Outer nodes before inner ones starting with them. */
const compare = (a: Node, b: Node): number =>
    a.start - b.start || b.end - a.end;

/** Generic traversal of syntax trees, child nodes in source order. */
// biome-ignore lint/complexity/noStaticOnlyClass: groups traversal helpers
export default class Walker {
    static isNode(value: unknown): value is Node {
        return (
            typeof value === "object" &&
            value !== null &&
            typeof (value as Partial<Node>).type === "string" &&
            typeof (value as Partial<Node>).start === "number"
        );
    }

    /** Child nodes by start, outer nodes before inner ones starting with them. */
    static children(node: Node): Node[] {
        const children: Node[] = [];
        const shorthand = node.type === "Property" && node.shorthand;

        for (const key of Object.keys(node)) {
            if (key === "comments") continue;
            // a shorthand property's key is its value too
            if (shorthand && key === "key") continue;

            const value: unknown = node[key as keyof Node];
            if (Array.isArray(value)) {
                for (const item of value)
                    if (Walker.isNode(item)) children.push(item);
            } else if (Walker.isNode(value)) children.push(value);
        }

        // mostly in order already, which a stable sort would keep as it is
        for (let index = 1; index < children.length; index++)
            if (
                compare(children[index - 1] as Node, children[index] as Node) >
                0
            )
                return children.sort(compare);
        return children;
    }
}
