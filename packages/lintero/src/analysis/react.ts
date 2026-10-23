import type { Node, NodeOf } from "@aljazmc/syntax";
import type Context from "./context.js";
import Nodes from "./nodes.js";

type Library = "react" | "react-dom";

const globals: Record<Library, string> = {
    react: "React",
    "react-dom": "ReactDOM",
};

/** React APIs, recognized like Biome: imported from the library, or on its global. */
// biome-ignore lint/complexity/noStaticOnlyClass: groups React helpers
export default class React {
    /** Whether a callee is a React API, like `React.createElement` or an imported `createElement`. */
    static is(
        context: Context,
        callee: Node,
        api: string,
        library: Library = "react",
    ): boolean {
        if (callee.type === "MemberExpression") {
            const { object } = callee;
            if (
                object.type !== "Identifier" ||
                Nodes.key(callee.property, callee.computed) !== api
            )
                return false;
            const specifier = React.#import(context, object, library);
            if (specifier === null) return object.name === globals[library];
            return (
                specifier !== undefined && specifier.type !== "ImportSpecifier"
            );
        }
        if (callee.type !== "Identifier") return false;
        const specifier = React.#import(context, callee, library);
        return (
            specifier?.type === "ImportSpecifier" &&
            Nodes.key(specifier.imported) === api
        );
    }

    /** The props object of a `createElement` call, if written as an object literal. */
    static props(
        context: Context,
        call: NodeOf<"CallExpression">,
        api = "createElement",
    ): NodeOf<"ObjectExpression"> | undefined {
        const props = call.arguments[1];
        if (
            React.is(context, call.callee, api) &&
            props?.type === "ObjectExpression"
        )
            return props;
    }

    /** The first `key: value` property of an object literal with a name. */
    static property(
        object: NodeOf<"ObjectExpression">,
        name: string,
        quoted = true,
    ): NodeOf<"Property"> | undefined {
        return object.properties.find(
            (property): property is NodeOf<"Property"> =>
                property.type === "Property" &&
                !property.shorthand &&
                !property.method &&
                property.kind === "init" &&
                (quoted ||
                    property.key.type === "Identifier" ||
                    property.computed) &&
                Nodes.key(property.key, property.computed) === name,
        );
    }

    /**
     * The import specifier an identifier is bound to from the library,
     * null for a global, undefined for any other binding.
     */
    static #import(
        context: Context,
        identifier: Node,
        library: Library,
    ): Node | null | undefined {
        const reference = context.semantic.referenced(identifier);
        const binding = reference?.binding;
        if (!binding) return null;
        const declaration = binding.declarations[0];
        if (declaration?.kind !== "import") return;
        const parent = context.parent(declaration.node);
        if (
            parent?.type === "ImportDeclaration" &&
            Nodes.string(parent.source) === library
        )
            return declaration.node;
    }
}
