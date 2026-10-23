import type { Node } from "@aljazmc/syntax";
import Jsx from "../../analysis/jsx.js";
import Nodes from "../../analysis/nodes.js";
import { type Edit, rule } from "../../rules.js";

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
    fix: "unsafe",
    languages: ["js"],
    create: (context) => {
        const report = (
            node: Node,
            name: string,
            children: boolean,
            html: boolean,
            edits: Edit[],
        ) => {
            const fix = { message: "Remove the children.", edits };
            if (children)
                context.report(
                    node,
                    `${name} is a void element tag and must not have children.`,
                    fix,
                );
            else if (html)
                context.report(
                    node,
                    `${name} is a void element tag and must not have the dangerouslySetInnerHTML prop.`,
                    fix,
                );
        };
        /** Removes attributes with the space before them. */
        const remove = (attribute: Node): Edit => {
            const start = context.text.slice(0, attribute.start).search(/\s*$/);
            return { start, end: attribute.end, text: "" };
        };
        return {
            JSXElement(node) {
                if (!node.name || !voids.has(node.name)) return;
                const props = ["children", "dangerouslySetInnerHTML"]
                    .map((name) => Jsx.attribute(node, name))
                    .filter((attribute) => attribute !== undefined);
                const edits = props.map(remove);
                // <br>child</br> becomes <br/>
                if (node.children.length > 0 && !node.selfClosing) {
                    const opening = Jsx.opening(node, context);
                    const text = node.attributes.length > 0 ? " />" : "/>";
                    edits.push({ start: opening.end - 1, end: node.end, text });
                }
                report(
                    node,
                    node.name,
                    node.children.length > 0 ||
                        Jsx.attribute(node, "children") !== undefined,
                    Jsx.attribute(node, "dangerouslySetInnerHTML") !==
                        undefined,
                    edits,
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
                const [first] = children;
                const last = children.at(-1);
                report(
                    node,
                    name,
                    children.length > 0 || keys.includes("children"),
                    keys.includes("dangerouslySetInnerHTML"),
                    first && last
                        ? [{ start: first.start, end: last.end, text: "" }]
                        : [],
                );
            },
        };
    },
});
