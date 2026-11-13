import {
    decode,
    type FontName,
    fontComponents,
    fontFamilies,
    fontFamilyKeywords,
    fontNameRange,
} from "../../analysis/css.js";
import { rule } from "../../rules.js";

/** A name to compare: strings without quotes equal identifiers, written together ones compare part by part. */
const key = (name: FontName, text: string): string =>
    (name.single ? "1" : "0") +
    name.values
        .map((value) =>
            value.type === "String"
                ? value.raw.slice(1, -1).trim()
                : text.slice(value.start, value.end).trim(),
        )
        .join("\u0000");

export default rule({
    name: "noDuplicateFontNames",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["css"],
    create: (context) => ({
        CssDeclaration(node) {
            const property = node.property.toLowerCase();
            const family = property === "font-family";
            if (!family && property !== "font") return;
            const text = context.text;
            const components = fontComponents(node.value);
            const families = fontFamilies(components, text);
            // `monospace, monospace` makes browsers keep their monospace size
            if (
                family &&
                components.length === 3 &&
                components[1]?.kind === "comma" &&
                families.length === 2 &&
                families.every(
                    (name) =>
                        name.single &&
                        name.values[0]?.type === "Identifier" &&
                        decode(name.values[0].value).toLowerCase() ===
                            "monospace",
                )
            )
                return;
            const seen = new Set<string>();
            for (const name of families) {
                const raw = name.values
                    .map((value) => context.slice(value))
                    .join(" ");
                const identifier = name.values.every(
                    (value) => value.type === "Identifier",
                );
                if (identifier && !family && fontFamilyKeywords.has(raw))
                    continue;
                const id = key(name, text);
                if (seen.has(id)) {
                    context.report(
                        fontNameRange(name),
                        `Duplicate font names are redundant and unnecessary: ${raw}`,
                    );
                    return;
                }
                seen.add(id);
            }
        },
    }),
});
