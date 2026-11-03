import { declarations } from "../../analysis/css.js";
import {
    LONGHAND_SUB_PROPERTIES_OF_SHORTHAND_PROPERTIES,
    RESET_TO_INITIAL_PROPERTIES_BY_BORDER,
    RESET_TO_INITIAL_PROPERTIES_BY_FONT,
    SHORTHAND_PROPERTIES,
} from "../../analysis/css-keywords.js";
import { rule } from "../../rules.js";

/** The properties a shorthand sets, or resets to their initial values. */
const overrides = new Map<string, Set<string>>(
    SHORTHAND_PROPERTIES.map((name, index) => [
        name,
        new Set([
            ...(LONGHAND_SUB_PROPERTIES_OF_SHORTHAND_PROPERTIES[index] ?? []),
            ...(name === "border" ? RESET_TO_INITIAL_PROPERTIES_BY_BORDER : []),
            ...(name === "font" ? RESET_TO_INITIAL_PROPERTIES_BY_FONT : []),
        ]),
    ]),
);

const prefix = (name: string): string =>
    /^-(?:moz|ms|o|webkit)-/.exec(name)?.[0] ?? "";

export default rule({
    name: "noShorthandPropertyOverrides",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["css"],
    create: (context) => ({
        CssBlock(block) {
            const prior: {
                name: string;
                prefix: string;
                unprefixed: string;
            }[] = [];
            for (const declaration of declarations(block)) {
                const name = declaration.property;
                const lower = name.toLowerCase();
                const vendor = prefix(lower);
                const unprefixed = lower.slice(vendor.length);
                const overridden = overrides.get(unprefixed);
                if (overridden)
                    for (const earlier of prior)
                        if (
                            earlier.prefix === vendor &&
                            overridden.has(earlier.unprefixed)
                        )
                            context.report(
                                {
                                    start: declaration.start,
                                    end: declaration.propertyEnd,
                                },
                                `This shorthand property ${name} overrides the earlier ${earlier.name} declaration.`,
                            );
                prior.push({ name, prefix: vendor, unprefixed });
            }
        },
    }),
});
