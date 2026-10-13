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
        "!**/main.ts",
        "!**/index.ts",
    ],
    coverageProvider: "v8",
    extensionsToTreatAsEsm: [".ts"],
    roots: ["<rootDir>/packages"],
    testMatch: ["**/tests/**/*.test.ts"],
    transform: {
        "^.+\\.ts$": ["jest-esbuild", { format: "esm", target: "esnext" }],
    },
};

export default config;
