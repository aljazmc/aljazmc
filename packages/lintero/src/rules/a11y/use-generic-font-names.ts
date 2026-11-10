import type { Css } from "@aljazmc/syntax";
import {
    type FontName,
    fontComponents,
    fontFamilies,
    fontFamilyKeywords,
    fontNameRange,
    isVariable,
    systemFamilyKeywords,
} from "../../analysis/css.js";
import { rule } from "../../rules.js";

export default rule({
    name: "useGenericFontNames",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["css"],
    create: (context) => ({
        CssDeclaration(node) {
            const property = node.property.toLowerCase();
            const font = property === "font";
            if (!font && property !== "font-family") return;
            const parent = context.cssParent(node);
            if (
                parent?.type === "AtRule" &&
                (parent.keyword === "font-face" ||
                    parent.keyword === "font-palette-values")
            )
                return;
            const components = fontComponents(node.value);
            const values = components.filter(
                (component) => component.kind === "value",
            );
            const only =
                values.length === 1 && components.length === 1
                    ? values[0]
                    : undefined;
            if (
                font &&
                only?.kind === "value" &&
                systemFamilyKeywords.has(context.slice(only.value))
            )
                return;
            const last = values.at(-1);
            if (last?.kind === "value" && isVariable(context.slice(last.value)))
                return;
            const families: FontName[] = font
                ? fontFamilies(components, context.text)
                : values
                      .map((component) =>
                          component.kind === "value" ? component.value : null,
                      )
                      .filter(
                          (value): value is Css.Identifier | Css.StringValue =>
                              value?.type === "Identifier" ||
                              value?.type === "String",
                      )
                      .map((value) => ({ values: [value], single: true }));
            if (families.length === 0) return;
            if (
                families.some(
                    (name) =>
                        name.single &&
                        fontFamilyKeywords.has(
                            context.slice(name.values[0] as Css.Value),
                        ),
                )
            )
                return;
            context.report(
                fontNameRange(families.at(-1) as FontName),
                "Generic font family missing.",
            );
        },
    }),
});
