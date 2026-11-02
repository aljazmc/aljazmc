import {
    properties as ariaProperties,
    explicitRole,
    globalProperties,
    implicitRole,
    properties,
    roles,
    supported,
} from "../../analysis/aria.js";
import Html, { AriaRoles } from "../../analysis/html.js";
import Jsx from "../../analysis/jsx.js";
import {
    fromRoles,
    globalAttributes,
    role as roleData,
} from "../../analysis/roles.js";
import { rule } from "../../rules.js";

/** Attributes of elements without a role, which can still be named. */
const named = new Set([
    ...globalProperties,
    "braillelabel",
    "brailleroledescription",
    "label",
    "labelledby",
    "roledescription",
]);

export default rule({
    name: "useAriaPropsSupportedByRole",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["html", "jsx"],
    create: (context) => ({
        JSXElement(node) {
            if (!Jsx.intrinsic(node)) return;
            const explicit = explicitRole(node);
            const role =
                explicit !== undefined && roles.has(explicit)
                    ? explicit
                    : implicitRole(node);
            const allowed = role === undefined ? named : supported(role);
            // like Biome, sections without a name may still be labelled
            if (node.name === "section" && role === "generic")
                allowed.add("label").add("labelledby");
            for (const attribute of node.attributes) {
                if (
                    attribute.type !== "JSXAttribute" ||
                    !attribute.name.startsWith("aria-")
                )
                    continue;
                const name = attribute.name.slice(5);
                if (!Object.hasOwn(properties, name) || allowed.has(name))
                    continue;
                context.report(
                    node,
                    `The ARIA attribute '${attribute.name}' is not supported by this element.`,
                );
                return;
            }
        },
        HtmlElement(node) {
            const value = Html.value(Html.attribute(node, "role"));
            const role =
                (value === undefined ? undefined : fromRoles(value)) ??
                AriaRoles.implicitRole(Html.aria(node));
            const data = role === undefined ? undefined : roleData(role);
            for (const attribute of node.attributes) {
                const name = attribute.name;
                if (
                    !name.startsWith("aria-") ||
                    ariaProperties[name.slice(5)] === undefined
                )
                    continue;
                const text = Html.value(attribute);
                if (text === "null" || text === "undefined") continue;
                if (
                    data?.prohibited.includes(name) ||
                    (!globalAttributes.has(name.slice(5)) &&
                        !data?.attributes.includes(name))
                ) {
                    context.report(
                        Html.opening(node),
                        `The ARIA attribute '${name}' is not supported by this element.`,
                    );
                    return;
                }
            }
        },
    }),
});
