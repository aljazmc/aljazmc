import type { Node } from "./ast.js";

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

        for (const [key, value] of Object.entries(node)) {
            if (key === "comments") continue;
            // a shorthand property's key is its value too
            if (node.type === "Property" && node.shorthand && key === "key")
                continue;

            if (Array.isArray(value)) {
                for (const item of value)
                    if (Walker.isNode(item)) children.push(item);
            } else if (Walker.isNode(value)) children.push(value);
        }

        return children.sort((a, b) => a.start - b.start || b.end - a.end);
    }
}
