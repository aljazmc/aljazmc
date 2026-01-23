import biome from "./biome.json" with { type: "json" };

const { formatter, javascript, json } = biome;

/** Formats this project like biome.json does. */
export default {
    ignore: [
        ".cache",
        ".git",
        ".yarn",
        "coverage",
        "node_modules",
        "packages/*/bin",
        "shared/*/bin",
        "yarn.lock",
        "*.tsbuildinfo",
    ],
    rules: {
        ...formatter,
        javascript: javascript.formatter,
        json: json.formatter,
    },
};
