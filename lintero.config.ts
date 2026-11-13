import biome from "./biome.json" with { type: "json" };

const { rules, ...linter } = biome.linter;

/** Lints this project with the settings of the imported JSON configuration. */
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
    rules: { ...linter, ...rules },
};
