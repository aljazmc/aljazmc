import type { Rules } from "./rules.js";

const extensions = "{js,jsx,ts,tsx,mjs,cjs,mts,cts}";

/** Jest's defaults. */
const rules: Rules = {
    testMatch: [
        `**/__tests__/**/*.${extensions}`,
        `**/*.{spec,test}.${extensions}`,
    ],
    testTimeout: 5000,
    bail: false,
    verbose: false,
    passWithNoTests: false,
    clearMocks: false,
    resetMocks: false,
    restoreMocks: false,
};

export default {
    ignore: [".git", "node_modules"],
    rules,
};
