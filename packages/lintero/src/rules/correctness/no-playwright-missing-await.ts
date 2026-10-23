import type { Node } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

/** Matchers that are always asynchronous. */
const asynchronous = [
    "toBeAttached",
    "toBeEditable",
    "toBeFocused",
    "toBeHidden",
    "toBeInViewport",
    "toBeOK",
    "toContainClass",
    "toContainText",
    "toHaveCount",
    "toHaveCSS",
    "toHaveId",
    "toHaveJSProperty",
    "toHaveScreenshot",
    "toHaveText",
    "toHaveTitle",
    "toHaveURL",
    "toHaveValues",
    "toMatchAriaSnapshot",
    "toPass",
];

/** Matchers asynchronous on pages and locators, but also known from other libraries. */
const onLocators = [
    "toBeChecked",
    "toBeDisabled",
    "toBeEmpty",
    "toBeEnabled",
    "toBeVisible",
    "toHaveAccessibleDescription",
    "toHaveAccessibleErrorMessage",
    "toHaveAccessibleName",
    "toHaveAttribute",
    "toHaveClass",
    "toHaveRole",
    "toHaveValue",
];

/** Whether a value looks like a Playwright page or locator, like `page` or `frame.locator("a")`. */
const playwright = (node: Node): boolean => {
    if (node.parenthesized) return false;
    switch (node.type) {
        case "Identifier":
            return node.name === "page";
        case "MemberExpression":
            return (
                !node.computed &&
                ((node.property.type === "Identifier" &&
                    node.property.name === "page") ||
                    playwright(node.object))
            );
        case "CallExpression":
            return (
                node.callee.type === "MemberExpression" &&
                !node.callee.computed &&
                ((node.callee.property.type === "Identifier" &&
                    node.callee.property.name === "locator") ||
                    playwright(node.callee.object))
            );
        default:
            return false;
    }
};

export default rule({
    name: "noPlaywrightMissingAwait",
    group: "correctness",
    severity: "error",
    recommended: false,
    fix: "unsafe",
    languages: ["js"],
    domains: { playwright: "recommended" },
    create: (context) => {
        /** Whether a promise is awaited or returned, also through `Promise.all([...])`. */
        const handled = (node: Node): boolean => {
            let current = node;
            for (;;) {
                const parent = context.parent(current);
                if (!parent) return false;
                if (
                    (parent.type === "MemberExpression" &&
                        parent.object === current) ||
                    (parent.type === "CallExpression" &&
                        parent.callee === current)
                ) {
                    current = parent;
                    continue;
                }
                if (parent.type === "ArrayExpression") {
                    const call = context.parent(parent);
                    const path =
                        call?.type === "CallExpression"
                            ? Nodes.path(call.callee)
                            : "";
                    if (
                        call?.type === "CallExpression" &&
                        call.arguments[0] === parent &&
                        [
                            "Promise.all",
                            "Promise.allSettled",
                            "Promise.any",
                            "Promise.race",
                        ].includes(path ?? "")
                    ) {
                        current = call;
                        continue;
                    }
                    return false;
                }
                return (
                    parent.type === "AwaitExpression" ||
                    parent.type === "ReturnStatement" ||
                    (parent.type === "ArrowFunctionExpression" &&
                        parent.body === current)
                );
            }
        };

        const fix = (node: Node) => ({
            message: "Add await.",
            edits: [{ start: node.start, end: node.start, text: "await " }],
        });

        return {
            CallExpression(node) {
                const { callee } = node;
                if (Nodes.path(callee) === "test.step") {
                    if (!handled(node))
                        context.report(
                            node,
                            "test.step must be awaited or returned.",
                            fix(node),
                        );
                    return;
                }
                if (callee.type !== "MemberExpression" || callee.computed)
                    return;
                const matcher = Nodes.key(callee.property);
                if (matcher === undefined) return;
                // expect(subject), expect.soft(subject), expect.poll(fn), through .not
                let object = callee.object;
                while (
                    object.type === "MemberExpression" &&
                    !object.computed &&
                    Nodes.key(object.property) === "not"
                )
                    object = object.object;
                if (object.type !== "CallExpression") return;
                const expect = object.callee;
                const poll = Nodes.path(expect) === "expect.poll";
                const isExpect =
                    (expect.type === "Identifier" &&
                        expect.name === "expect") ||
                    (expect.type === "MemberExpression" &&
                        !expect.computed &&
                        expect.object.type === "Identifier" &&
                        expect.object.name === "expect");
                if (!isExpect || handled(node)) return;
                const subject = object.arguments[0];
                if (poll)
                    context.report(
                        object,
                        "expect.poll must be awaited or returned.",
                        fix(object),
                    );
                else if (
                    asynchronous.includes(matcher) ||
                    (onLocators.includes(matcher) &&
                        subject !== undefined &&
                        playwright(subject))
                )
                    context.report(
                        object,
                        `Async matcher ${matcher} must be awaited or returned.`,
                        fix(object),
                    );
            },
        };
    },
});
