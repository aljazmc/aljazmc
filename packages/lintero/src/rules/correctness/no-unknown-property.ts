import {
    KNOWN_CHROME_PROPERTIES,
    KNOWN_EDGE_PROPERTIES,
    KNOWN_EXPLORER_PROPERTIES,
    KNOWN_FIREFOX_PROPERTIES,
    KNOWN_PROPERTIES,
    KNOWN_SAFARI_PROPERTIES,
    KNOWN_SAMSUNG_INTERNET_PROPERTIES,
    KNOWN_US_BROWSER_PROPERTIES,
} from "../../analysis/css-keywords.js";
import { rule } from "../../rules.js";

const known = new Set([
    ...KNOWN_PROPERTIES,
    ...KNOWN_CHROME_PROPERTIES,
    ...KNOWN_EDGE_PROPERTIES,
    ...KNOWN_EXPLORER_PROPERTIES,
    ...KNOWN_FIREFOX_PROPERTIES,
    ...KNOWN_SAFARI_PROPERTIES,
    ...KNOWN_SAMSUNG_INTERNET_PROPERTIES,
    ...KNOWN_US_BROWSER_PROPERTIES,
]);

/** At-rules whose blocks hold style declarations, others hold descriptors. */
const styling = new Set([
    "container",
    "layer",
    "media",
    "scope",
    "starting-style",
    "supports",
    "function",
]);

export default rule<{ ignore?: string[] }>({
    name: "noUnknownProperty",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["css"],
    options: { ignore: [] },
    create: (context) => ({
        CssDeclaration(node) {
            let inFunction = false;
            for (const ancestor of context.cssAncestors(node)) {
                if (ancestor.type !== "AtRule") continue;
                if (!styling.has(ancestor.keyword)) return;
                if (ancestor.keyword === "function") inFunction = true;
            }
            const name = node.property.toLowerCase();
            if (inFunction && name === "result") return;
            if (
                name.startsWith("--") ||
                name === "composes" ||
                known.has(name) ||
                /^-(?:webkit|moz|ms|o)-/.test(name) ||
                (context.options.ignore ?? []).some(
                    (ignore) => ignore.toLowerCase() === name,
                )
            )
                return;
            context.report(
                { start: node.start, end: node.propertyEnd },
                "Unknown property is not allowed.",
            );
        },
    }),
});
