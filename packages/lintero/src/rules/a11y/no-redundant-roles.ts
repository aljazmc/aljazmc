import { attribute, implicitRole, text, tokens } from "../../analysis/aria.js";
import Html, { AriaRoles } from "../../analysis/html.js";
import Jsx from "../../analysis/jsx.js";
import { fromRoles } from "../../analysis/roles.js";
import { rule } from "../../rules.js";

export default rule<{ ignoreElements?: string[] }>({
    name: "noRedundantRoles",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "unsafe",
    languages: ["html", "jsx"],
    options: { ignoreElements: [] },
    create: (context) => ({
        JSXElement(node) {
            const name = node.name ?? "";
            if (!Jsx.intrinsic(node)) return;
            if (
                (context.options.ignoreElements ?? []).some(
                    (ignored) => ignored.toLowerCase() === name.toLowerCase(),
                )
            )
                return;
            const role = attribute(node, "role");
            const value = text(role);
            if (!role?.value || value === undefined) return;
            const [first] = tokens(value);
            if (first === undefined || first !== implicitRole(node)) return;
            context.report(
                role.value,
                `Using the role attribute '${value}' on the '${name}' element is redundant.`,
                {
                    message: "Remove the role attribute.",
                    edits: [{ start: role.start, end: role.end, text: "" }],
                },
            );
        },
        HtmlElement(node) {
            if (
                (context.options.ignoreElements ?? []).some(
                    (ignored) =>
                        ignored.toLowerCase() === node.name.toLowerCase(),
                )
            )
                return;
            const attribute = Html.attribute(node, "role");
            const value = Html.value(attribute);
            if (!attribute || value === undefined) return;
            const trimmed = value.trim();
            const explicit = fromRoles(trimmed);
            if (explicit === undefined) return;
            if (AriaRoles.implicitRole(Html.aria(node)) !== explicit) return;
            context.report(
                attribute,
                `Using the role attribute '${value}' on the '${node.name}' element is redundant.`,
                {
                    message: "Remove the role attribute.",
                    edits: [
                        {
                            start: attribute.start,
                            end: attribute.end,
                            text: "",
                        },
                    ],
                },
            );
        },
    }),
});
