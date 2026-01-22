import type { Rules } from "./rules.js";

/** Biome's linter defaults, with the recommended rules. */
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
};

export default {
    ignore: [".git", "node_modules"],
    rules,
};
