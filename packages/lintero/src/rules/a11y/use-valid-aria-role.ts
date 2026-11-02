import { attribute, roles, text, tokens } from "../../analysis/aria.js";
import Html from "../../analysis/html.js";
import Jsx from "../../analysis/jsx.js";
import { fromRoles } from "../../analysis/roles.js";
import { rule } from "../../rules.js";

export default rule<{ allowInvalidRoles?: string[]; ignoreNonDom?: boolean }>({
    name: "useValidAriaRole",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "unsafe",
    languages: ["html", "jsx"],
    options: { allowInvalidRoles: [], ignoreNonDom: false },
    create: (context) => ({
        JSXElement(node) {
            if (context.options.ignoreNonDom && !Jsx.intrinsic(node)) return;
            const role = attribute(node, "role");
            const value = text(role);
            if (!role || value === undefined) return;
            const allowed = context.options.allowInvalidRoles ?? [];
            const list = tokens(value);
            if (
                list.length > 0 &&
                list.every(
                    (token) => roles.has(token) || allowed.includes(token),
                )
            )
                return;
            context.report(
                node,
                "Enforce that elements with ARIA roles must use a valid, non-abstract ARIA role.",
                {
                    message: "Remove the invalid role attribute.",
                    edits: [{ start: role.start, end: role.end, text: "" }],
                },
            );
        },
        HtmlElement(node) {
            const attribute = Html.attribute(node, "role");
            const value = Html.value(attribute)?.trim();
            if (!attribute || value === undefined) return;
            const allowed = context.options.allowInvalidRoles ?? [];
            const valid =
                value !== "" &&
                value
                    .split(/[\t\n\f\r ]+/)
                    .every(
                        (role) =>
                            fromRoles(role) !== undefined ||
                            allowed.includes(role),
                    );
            if (!valid)
                context.report(
                    Html.opening(node),
                    "Enforce that elements with ARIA roles must use a valid, non-abstract ARIA role.",
                );
        },
    }),
});
