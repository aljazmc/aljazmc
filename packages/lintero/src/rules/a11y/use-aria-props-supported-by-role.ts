import {
    explicitRole,
    globalProperties,
    implicitRole,
    properties,
    roles,
    supported,
} from "../../analysis/aria.js";
import Jsx from "../../analysis/jsx.js";
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
    languages: ["jsx"],
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
    }),
});
