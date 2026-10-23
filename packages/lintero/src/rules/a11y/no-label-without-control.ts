import type { Node } from "@aljazmc/syntax";
import { attribute, text } from "../../analysis/aria.js";
import { rule } from "../../rules.js";

interface Options {
    inputComponents?: string[];
    labelAttributes?: string[];
    labelComponents?: string[];
}

const inputs = [
    "input",
    "meter",
    "output",
    "progress",
    "select",
    "textarea",
    "button",
];

export default rule<Options>({
    name: "noLabelWithoutControl",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["jsx"],
    options: { inputComponents: [], labelAttributes: [], labelComponents: [] },
    create: (context) => {
        const controls = [
            ...inputs,
            ...(context.options.inputComponents ?? []),
        ];
        const labels = ["label", ...(context.options.labelComponents ?? [])];
        const labelAttributes = [
            "aria-label",
            "aria-labelledby",
            "alt",
            ...(context.options.labelAttributes ?? []),
        ];

        /** Whether children hold an input, at any depth. */
        const control = (children: Node[]): boolean =>
            children.some(
                (child) =>
                    child.type === "JSXElement" &&
                    child.name !== null &&
                    (controls.includes(child.name) || control(child.children)),
            );
        /** Whether children have text, like words, expressions or image alternatives. */
        const textual = (children: Node[]): boolean =>
            children.some((child) => {
                if (child.type === "JSXText") return child.raw !== "";
                if (child.type === "JSXExpressionContainer")
                    return child.expression !== null;
                if (child.type !== "JSXElement" || child.name === null)
                    return false;
                if (child.name === "img" && text(attribute(child, "alt")))
                    return true;
                return textual(child.children);
            });

        return {
            JSXElement(node) {
                if (!labels.includes(node.name ?? "")) return;
                const associated =
                    attribute(node, "for") !== undefined ||
                    attribute(node, "htmlFor") !== undefined ||
                    control(node.children);
                const labelled =
                    labelAttributes.some(
                        (name) => attribute(node, name) !== undefined,
                    ) || textual(node.children);
                if (!associated || !labelled)
                    context.report(
                        node,
                        "A form label must be associated with an input.",
                    );
            },
        };
    },
});
