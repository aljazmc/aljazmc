/** @jest-config-loader esbuild-register */
/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

import type { Config } from "jest";

const config: Config = {
    clearMocks: true,
    collectCoverageFrom: [
        "packages/*/src/**/*.ts",
        "shared/*/src/**/*.ts",
        "!**/main.ts",
        "!**/index.ts",
        "!packages/*/src/config.ts",
        "!packages/formatero/src/rules.ts",
        "!packages/formatero/src/tokens/token.ts",
    ],
    coverageProvider: "v8",
    extensionsToTreatAsEsm: [".ts"],
    moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
    roots: ["<rootDir>/packages", "<rootDir>/shared"],
    testMatch: ["**/tests/**/*.test.ts"],
    transform: {
        "^.+\\.ts$": ["jest-esbuild", { format: "esm", target: "esnext" }],
    },
};

export default config;
