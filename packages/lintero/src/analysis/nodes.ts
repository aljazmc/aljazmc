import { type Node, Walker } from "@aljazmc/syntax";

/** Node predicates and static evaluation shared by rules. */
// biome-ignore lint/complexity/noStaticOnlyClass: groups node helpers
export default class Nodes {
    static isFunction(node: Node | null | undefined): boolean {
        return (
            node?.type === "FunctionDeclaration" ||
            node?.type === "FunctionExpression" ||
            node?.type === "ArrowFunctionExpression"
        );
    }

    /** Strips TypeScript wrappers like `as`, `satisfies` and `!`. */
    static unwrap(node: Node): Node {
        let current = node;
        while (
            current.type === "TSAsExpression" ||
            current.type === "TSSatisfiesExpression" ||
            current.type === "TSNonNullExpression" ||
            current.type === "TSTypeAssertion"
        )
            current = current.expression;
        return current;
    }

    /** The value of a string literal or a template without interpolations. */
    static string(node: Node | null | undefined): string | undefined {
        if (node?.type === "StringLiteral") return Nodes.unquote(node.raw);
        if (node?.type === "TemplateLiteral" && node.expressions.length === 0)
            return Nodes.unquote(`\`${node.quasis[0]?.raw ?? ""}\``);
    }

    /** Evaluates the escapes of a quoted string. */
    static unquote(raw: string): string {
        return raw
            .slice(1, -1)
            .replace(
                /\\(?:u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|(\r\n|[\s\S]))/g,
                (_, braced, unicode, hex, char: string) => {
                    const code = braced ?? unicode ?? hex;
                    if (code)
                        return String.fromCodePoint(Number.parseInt(code, 16));
                    const escapes: Record<string, string> = {
                        b: "\b",
                        f: "\f",
                        n: "\n",
                        r: "\r",
                        t: "\t",
                        v: "\v",
                        "0": "\0",
                        "\n": "",
                        "\r": "",
                        "\r\n": "",
                        " ": "",
                        " ": "",
                    };
                    return escapes[char] ?? char;
                },
            );
    }

    /** The name of a property key, if static. */
    static key(key: Node, computed = false): string | undefined {
        if (!computed && key.type === "Identifier") return key.name;
        if (key.type === "PrivateName") return `#${key.name}`;
        if (key.type === "NumericLiteral") return String(Nodes.number(key.raw));
        return Nodes.string(key);
    }

    static number(raw: string): number {
        const clean = raw.replace(/_/g, "").replace(/n$/, "");
        if (/^0[0-7]+$/.test(clean)) return Number.parseInt(clean, 8);
        return Number(clean);
    }

    /** A dotted name like `Math.pow` for identifiers and static member accesses. */
    static path(node: Node): string | undefined {
        const current = Nodes.unwrap(node);
        if (current.type === "Identifier") return current.name;
        if (current.type === "ThisExpression") return "this";
        if (current.type !== "MemberExpression") return;
        const object = Nodes.path(current.object);
        const property = Nodes.key(current.property, current.computed);
        return object !== undefined && property !== undefined
            ? `${object}.${property}`
            : undefined;
    }

    /** The object of a member access, or of a call through one. */
    static member(node: Node): { object: Node; name: string } | undefined {
        const current = Nodes.unwrap(node);
        if (current.type !== "MemberExpression") return;
        const name = Nodes.key(current.property, current.computed);
        return name === undefined
            ? undefined
            : { object: current.object, name };
    }

    /** Whether two nodes are the same syntax, ignoring positions and comments. */
    static same(
        a: Node | null | undefined,
        b: Node | null | undefined,
    ): boolean {
        if (!a || !b) return a === b;
        if (a.type !== b.type) {
            const left = Nodes.string(a);
            return left !== undefined && left === Nodes.string(b);
        }
        if (a.type === "StringLiteral" && b.type === "StringLiteral")
            return Nodes.unquote(a.raw) === Nodes.unquote(b.raw);

        for (const key of Object.keys(a)) {
            if (["start", "end", "comments", "parenthesized"].includes(key))
                continue;
            const left = (a as unknown as Record<string, unknown>)[key];
            const right = (b as unknown as Record<string, unknown>)[key];
            if (Array.isArray(left) && Array.isArray(right)) {
                if (left.length !== right.length) return false;
                for (const [index, item] of left.entries())
                    if (!Nodes.#equal(item, right[index])) return false;
            } else if (!Nodes.#equal(left, right)) return false;
        }
        return true;
    }

    static #equal(a: unknown, b: unknown): boolean {
        if (Walker.isNode(a) && Walker.isNode(b)) return Nodes.same(a, b);
        return a === b;
    }

    /** Whether evaluating a node can have side effects, conservatively. */
    static pure(node: Node): boolean {
        switch (node.type) {
            case "Identifier":
            case "ThisExpression":
            case "StringLiteral":
            case "NumericLiteral":
            case "BooleanLiteral":
            case "NullLiteral":
            case "RegExpLiteral":
                return true;
            case "MemberExpression":
                return (
                    Nodes.pure(node.object) &&
                    (!node.computed || Nodes.pure(node.property))
                );
            default:
                return false;
        }
    }
}
