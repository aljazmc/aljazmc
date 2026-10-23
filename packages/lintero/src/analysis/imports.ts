import type { Node } from "@aljazmc/syntax";
import type Context from "./context.js";
import Nodes from "./nodes.js";

/** Where references come from, by the imports they are bound to. */
// biome-ignore lint/complexity/noStaticOnlyClass: groups import helpers
export default class Imports {
    /** The module and specifier of the import a reference, like an identifier or a JSX name, is bound to. */
    static of(
        context: Context,
        node: Node,
    ): { source: string; specifier: Node } | undefined {
        const declaration =
            context.semantic.referenced(node)?.binding?.declarations[0];
        if (declaration?.kind !== "import") return;
        const parent = context.parent(declaration.node);
        const source =
            parent?.type === "ImportDeclaration"
                ? Nodes.string(parent.source)
                : undefined;
        if (source !== undefined)
            return { source, specifier: declaration.node };
    }

    /** The directories and file name of a path, like `["src", "pages", "_document.jsx"]`. */
    static segments(file: string): string[] {
        return file.split(/[\\/]/).filter((segment) => segment !== "");
    }
}
