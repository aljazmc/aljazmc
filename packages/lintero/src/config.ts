import type { Rules } from "./rules.js";

/** The linter defaults, with the recommended rules. */
const rules: Rules = {
    enabled: true,
    includes: ["**"],
    domains: {},
    preset: "recommended",
    javascript: {
        enabled: true,
        globals: [],
        jsxRuntime: "transparent",
    },
    json: {
        enabled: true,
    },
    assist: {
        enabled: true,
        actions: { source: { organizeImports: "on" } },
    },
    markdown: {
        enabled: true,
    },
    html: {
        enabled: true,
    },
    css: {
        enabled: true,
    },
};

export default {
    ignore: [".git", "node_modules"],
    rules,
};
