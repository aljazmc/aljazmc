import type { Node } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import Vue from "../../analysis/vue.js";
import { rule } from "../../rules.js";

const reserved = ["key", "ref"];

export default rule({
    name: "noVueReservedProps",
    group: "correctness",
    severity: "error",
    recommended: false,
    fix: "none",
    languages: ["js"],
    domains: { vue: "recommended" },
    create: (context) => {
        const check = (node: Node, name: string | undefined) => {
            if (name !== undefined && reserved.includes(name))
                context.report(
                    node,
                    `${name} is a reserved attribute and cannot be used as props.`,
                );
        };
        return {
            CallExpression(node) {
                const options = Vue.component(context, node);
                const props = options && Vue.option(options, "props")?.value;
                if (props?.type === "ArrayExpression")
                    for (const element of props.elements) {
                        if (element?.type === "StringLiteral")
                            check(element, Nodes.string(element));
                    }
                else if (props?.type === "ObjectExpression")
                    for (const property of props.properties)
                        if (property.type === "Property")
                            check(
                                property.key,
                                Nodes.key(property.key, property.computed),
                            );
            },
        };
    },
});
