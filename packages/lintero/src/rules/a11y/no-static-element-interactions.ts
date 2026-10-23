import { explicitRole, implicitRole } from "../../analysis/aria.js";
import { rule } from "../../rules.js";

/** Elements without semantics, which need a role to be interacted with. */
const statics = new Set(
    "a area abbr b bdi bdo body cite col colgroup data div footer head header hgroup i img kbd link map noscript object picture q rp rt s samp section slot small source span summary template track u var wbr".split(
        " ",
    ),
);

/** Events of the mouse, keyboard and focus, lowercase after `on`. */
const events = new Set(
    "blur click contextmenu dblclick doubleclick drag dragend dragenter dragexit dragleave dragover dragstart drop focus keydown keypress keyup mousedown mouseenter mouseleave mousemove mouseout mouseover mouseup".split(
        " ",
    ),
);

export default rule({
    name: "noStaticElementInteractions",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["jsx"],
    create: (context) => ({
        JSXElement(node) {
            const name = node.name ?? "";
            if (!statics.has(name)) return;
            const implicit = implicitRole(node);
            // links with a destination, images with a text alternative and named sections have semantics
            if (
                (name === "a" ||
                    name === "area" ||
                    name === "img" ||
                    name === "section") &&
                implicit !== "generic" &&
                implicit !== "presentation"
            )
                return;
            const role = explicitRole(node);
            if (
                role !== undefined &&
                role !== "generic" &&
                role !== "presentation"
            )
                return;
            const handles = node.attributes.some(
                (attribute) =>
                    attribute.type === "JSXAttribute" &&
                    /^on/i.test(attribute.name) &&
                    events.has(attribute.name.slice(2).toLowerCase()),
            );
            if (handles)
                context.report(
                    node,
                    "Unexpected event handler on static element.",
                );
        },
    }),
});
