import type { Rules } from "./rules.js";

/** Biome's formatter defaults. */
const rules: Rules = {
    enabled: true,
    includes: ["**"],
    useEditorconfig: false,
    indentStyle: "tab",
    indentWidth: 2,
    lineEnding: "lf",
    lineWidth: 80,
    trailingNewline: true,
    expand: "auto",
    formatWithErrors: false,
    attributePosition: "auto",
    bracketSameLine: false,
    bracketSpacing: true,
    delimiterSpacing: false,
    javascript: {
        arrowParentheses: "always",
        jsxQuoteStyle: "double",
        operatorLinebreak: "after",
        quoteProperties: "asNeeded",
        quoteStyle: "double",
        semicolons: "always",
        trailingCommas: "all",
    },
    json: {
        trailingCommas: "none",
    },
    html: {
        // like Biome, formatting HTML is experimental and off unless enabled
        enabled: false,
        // unlike other languages, HTML ends with a newline unless it is disabled for HTML
        trailingNewline: true,
        indentScriptAndStyle: false,
        selfCloseVoidElements: "never",
        whitespaceSensitivity: "css",
    },
    markdown: {
        proseWrap: "preserve",
        formatEmbeds: true,
    },
};

export default {
    ignore: [".git", "node_modules"],
    rules,
};
