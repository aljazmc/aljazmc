import type { Node, NodeOf } from "@aljazmc/syntax";
import type Context from "./context.js";
import Imports from "./imports.js";
import Nodes from "./nodes.js";

/** Vue APIs, recognized through their imports from `vue`. */
// biome-ignore lint/complexity/noStaticOnlyClass: groups Vue helpers
export default class Vue {
    /** Whether a callee is a function imported from vue, like `defineComponent`. */
    static imported(context: Context, callee: Node, names: string[]): boolean {
        if (callee.type !== "Identifier") return false;
        const imported = Imports.of(context, callee);
        return (
            imported?.source === "vue" &&
            imported.specifier.type === "ImportSpecifier" &&
            names.includes(Nodes.key(imported.specifier.imported) ?? "")
        );
    }

    /** The options object of `defineComponent({...})` or `createApp({...})`. */
    static component(
        context: Context,
        call: NodeOf<"CallExpression">,
    ): NodeOf<"ObjectExpression"> | undefined {
        const [options] = call.arguments;
        if (
            options?.type === "ObjectExpression" &&
            Vue.imported(context, call.callee, ["defineComponent", "createApp"])
        )
            return options;
    }

    /** The `name: value` property of a component's options. */
    static option(
        options: NodeOf<"ObjectExpression">,
        name: string,
    ): NodeOf<"Property"> | undefined {
        return options.properties.find(
            (property): property is NodeOf<"Property"> =>
                property.type === "Property" &&
                !property.method &&
                Nodes.key(property.key, property.computed) === name,
        );
    }
}
