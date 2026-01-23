/** Runs this project's tests like jest.config.ts does. */
export default {
    ignore: [
        ".cache",
        ".git",
        ".yarn",
        "coverage",
        "node_modules",
        "packages/*/bin",
        "shared/*/bin",
    ],
    rules: {
        testMatch: ["**/tests/**/*.test.ts"],
        clearMocks: true,
    },
};
