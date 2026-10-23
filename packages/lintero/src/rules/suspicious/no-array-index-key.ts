import type { Node } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import React from "../../analysis/react.js";
import { rule } from "../../rules.js";

/** Methods passing an index to their callback, with the parameter position of the index. */
const methods: Record<string, number> = {
    every: 1,
    filter: 1,
    find: 1,
    findIndex: 1,
    flatMap: 1,
    forEach: 1,
    from: 1,
    map: 1,
    reduce: 2,
    reduceRight: 2,
    some: 1,
};

export default rule({
    name: "noArrayIndexKey",
    group: "suspicious",
    severity: "error",
    recommended: false,
    fix: "none",
    languages: ["js", "jsx"],
    domains: { react: "recommended" },
    create: (context) => {
        /** Whether an identifier is the index parameter of an iteration callback. */
        const isIndex = (identifier: Node): boolean => {
            const declaration =
                context.semantic.referenced(identifier)?.binding
                    ?.declarations[0];
            if (declaration?.kind !== "parameter") return false;
            const callback = declaration.node;
            if (
                callback.type !== "ArrowFunctionExpression" &&
                callback.type !== "FunctionExpression"
            )
                return false;
            const call = context.parent(callback);
            if (
                call?.type !== "CallExpression" ||
                !call.arguments.includes(callback)
            )
                return false;
            const method = Nodes.member(call.callee)?.name;
            const position = method !== undefined ? methods[method] : undefined;
            if (position === undefined) return false;
            let param = callback.params[position];
            if (param?.type === "AssignmentPattern") param = param.left;
            return param === declaration.id;
        };

        /** The index identifiers a key is made of, like `index`, `"a" + index` or `` `${index}` ``. */
        const indexes = (node: Node): Node[] => {
            if (node.type === "Identifier") return isIndex(node) ? [node] : [];
            if (node.type === "BinaryExpression")
                return [...indexes(node.left), ...indexes(node.right)];
            if (node.type === "TemplateLiteral")
                return node.expressions.flatMap(indexes);
            return [];
        };
        const message =
            "Avoid using the index of an array as key property in an element.";
        const check = (value: Node) => {
            const [first] = indexes(value);
            if (first) context.report(first, message);
        };

        return {
            JSXElement(node) {
                const key = node.attributes.find(
                    (attribute) =>
                        attribute.type === "JSXAttribute" &&
                        attribute.name === "key",
                );
                if (
                    key?.type === "JSXAttribute" &&
                    key.value?.type === "JSXExpressionContainer" &&
                    key.value.expression
                )
                    check(key.value.expression);
            },
            CallExpression(node) {
                const props = node.arguments[1];
                if (
                    !React.is(context, node.callee, "cloneElement") ||
                    props?.type !== "ObjectExpression"
                )
                    return;
                const key = React.property(props, "key", false);
                if (key) check(key.value);
            },
        };
    },
});
