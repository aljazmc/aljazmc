import type { Node } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

/** Autofill field names, and the tokens allowed beside them. */
const fields = new Set([
    "name",
    "honorific-prefix",
    "given-name",
    "additional-name",
    "family-name",
    "honorific-suffix",
    "nickname",
    "username",
    "new-password",
    "current-password",
    "one-time-code",
    "organization-title",
    "organization",
    "street-address",
    "address-line1",
    "address-line2",
    "address-line3",
    "address-level4",
    "address-level3",
    "address-level2",
    "address-level1",
    "country",
    "country-name",
    "postal-code",
    "cc-name",
    "cc-given-name",
    "cc-additional-name",
    "cc-family-name",
    "cc-number",
    "cc-exp",
    "cc-exp-month",
    "cc-exp-year",
    "cc-csc",
    "cc-type",
    "transaction-currency",
    "transaction-amount",
    "language",
    "bday",
    "bday-day",
    "bday-month",
    "bday-year",
    "sex",
    "url",
    "photo",
    "tel",
    "tel-country-code",
    "tel-national",
    "tel-area-code",
    "tel-local",
    "tel-extension",
    "email",
    "impp",
    "webauthn",
    "on",
    "off",
]);

/** Whether a value is like `section-a shipping street-address`. */
const valid = (value: string): boolean => {
    const tokens = value.split(/\s+/).filter((token) => token !== "");
    let index = 0;
    while (tokens[index]?.startsWith("section-")) index++;
    if (tokens[index] === "shipping" || tokens[index] === "billing") {
        index++;
        if (index === tokens.length) return false;
    }
    return tokens.slice(index).every((token) => fields.has(token));
};

export default rule<{ inputComponents?: string[] }>({
    name: "useValidAutocomplete",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["jsx"],
    options: { inputComponents: [] },
    create: (context) => ({
        JSXElement(node) {
            if (
                node.name !== "input" &&
                !(context.options.inputComponents ?? []).includes(
                    node.name ?? "",
                )
            )
                return;
            for (const attribute of node.attributes) {
                if (
                    attribute.type !== "JSXAttribute" ||
                    (attribute.name !== "autocomplete" &&
                        attribute.name !== "autoComplete")
                )
                    continue;
                let value: Node | null = attribute.value;
                if (value?.type === "JSXExpressionContainer")
                    value = value.expression;
                if (
                    value?.type === "StringLiteral" &&
                    !valid(value.raw.slice(1, -1))
                )
                    context.report(
                        attribute,
                        "Use valid values for the autocomplete attribute.",
                    );
            }
        },
    }),
});
