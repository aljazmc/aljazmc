import Vue from "../../analysis/vue.js";
import { rule } from "../../rules.js";

/** Vue's built-in components, and the root `App`. */
const builtins = [
    "app",
    "component",
    "keepalive",
    "keep-alive",
    "slot",
    "suspense",
    "teleport",
    "template",
    "transition",
    "transitiongroup",
    "transition-group",
];

/** Whether a name has several words, like `my-component`, `my_component` or `MyComponent`. */
const multiWord = (name: string): boolean =>
    /[-_]/.test(name) ||
    /\p{Ll}\p{Lu}/u.test(name) ||
    /\p{Lu}\p{Lu}\p{Ll}/u.test(name);

export default rule<{ ignores?: string[] }>({
    name: "useVueMultiWordComponentNames",
    group: "style",
    severity: "info",
    recommended: false,
    fix: "none",
    languages: ["js"],
    domains: { vue: "recommended" },
    options: { ignores: [] },
    create: (context) => {
        const ignored = [
            ...builtins,
            ...(context.options.ignores ?? []).map((name) =>
                name.toLowerCase(),
            ),
        ];
        return {
            CallExpression(node) {
                const options = Vue.component(context, node);
                const value = options && Vue.option(options, "name")?.value;
                if (value?.type !== "StringLiteral") return;
                const name = value.raw.slice(1, -1);
                if (!multiWord(name) && !ignored.includes(name.toLowerCase()))
                    context.report(
                        value,
                        `This Component's name "${name}" only contains one word.`,
                    );
            },
        };
    },
});
