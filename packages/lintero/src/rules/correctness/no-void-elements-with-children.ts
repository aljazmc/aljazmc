import type { Node } from "@aljazmc/syntax";
import Jsx from "../../analysis/jsx.js";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

const voids = new Set([
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "keygen",
    "link",
    "menuitem",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
]);

export default rule({
    name: "noVoidElementsWithChildren",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => {
        const report = (
            node: Node,
            name: string,
            children: boolean,
            html: boolean,
        ) => {
            if (children)
                context.report(
                    node,
                    `${name} is a void element tag and must not have children.`,
                );
            else if (html)
                context.report(
                    node,
                    `${name} is a void element tag and must not have the dangerouslySetInnerHTML prop.`,
                );
        };
        return {
            JSXElement(node) {
                if (!node.name || !voids.has(node.name)) return;
                report(
                    node,
                    node.name,
                    node.children.length > 0 ||
                        Jsx.attribute(node, "children") !== undefined,
                    Jsx.attribute(node, "dangerouslySetInnerHTML") !==
                        undefined,
                );
            },
            CallExpression(node) {
                const path = Nodes.path(node.callee);
                if (path !== "React.createElement" && path !== "createElement")
                    return;
                const [type, props, ...children] = node.arguments;
                const name = Nodes.string(type);
                if (name === undefined || !voids.has(name)) return;
                const keys =
                    props?.type === "ObjectExpression"
                        ? props.properties.map((property) =>
                              property.type === "Property"
                                  ? Nodes.key(property.key, property.computed)
                                  : undefined,
                          )
                        : [];
                report(
                    node,
                    name,
                    children.length > 0 || keys.includes("children"),
                    keys.includes("dangerouslySetInnerHTML"),
                );
            },
        };
    },
});
