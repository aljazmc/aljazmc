import { attribute, required, text, tokens } from "../../analysis/aria.js";
import Html from "../../analysis/html.js";
import Jsx from "../../analysis/jsx.js";
import { fromRoles, role as roleData } from "../../analysis/roles.js";
import { rule } from "../../rules.js";

export default rule({
    name: "useAriaPropsForRole",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["html", "jsx"],
    create: (context) => ({
        JSXElement(node) {
            if (!Jsx.intrinsic(node)) return;
            const role = attribute(node, "role");
            if (role?.value?.type !== "StringLiteral") return;
            const value = text(role) ?? "";
            const [first] = tokens(value);
            if (first === undefined) return;
            // separators only take values when they are focusable
            const needs =
                first === "separator"
                    ? attribute(node, "tabIndex")
                        ? ["valuenow"]
                        : []
                    : required(first);
            if (needs.some((name) => !attribute(node, `aria-${name}`)))
                context.report(
                    role,
                    `The element with the ${value} ARIA role does not have the required ARIA attributes.`,
                );
        },
        HtmlElement(node) {
            const attribute = Html.attribute(node, "role");
            const value = Html.value(attribute);
            if (!attribute || value === undefined) return;
            const role = fromRoles(value.trim());
            if (role === undefined) return;
            if (role === "separator" && !Html.has(node, "tabindex")) return;
            const missing = (roleData(role)?.required ?? []).filter(
                (name) => !Html.has(node, name),
            );
            if (missing.length === 0) return;
            context.report(
                attribute,
                `The element with the ${value} ARIA role does not have the required ARIA attributes.`,
            );
        },
    }),
});
