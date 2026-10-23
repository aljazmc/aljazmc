import {
    attribute,
    nonInteractiveElement,
    text,
    tokens,
} from "../../analysis/aria.js";
import { rule } from "../../rules.js";

/** Interactive roles of elements users focus, unlike containers managing the focus of their items. */
const focusable = new Set(
    "button checkbox columnheader combobox gridcell link menuitem menuitemcheckbox menuitemradio option radio row rowheader scrollbar searchbox slider switch tab textbox treeitem doc-backlink doc-biblioref doc-glossref doc-noteref doc-pagebreak".split(
        " ",
    ),
);

export default rule({
    name: "useFocusableInteractive",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["jsx"],
    create: (context) => ({
        JSXElement(node) {
            const name = node.name ?? "";
            if (
                name !== "div" &&
                name !== "span" &&
                !nonInteractiveElement(node)
            )
                return;
            const role = attribute(node, "role");
            const value = text(role);
            if (
                !role?.value ||
                value === undefined ||
                attribute(node, "tabIndex")
            )
                return;
            if (!tokens(value).some((token) => focusable.has(token))) return;
            context.report(
                node,
                `The HTML element with the interactive role ${context.slice(role.value)} is not focusable.`,
            );
        },
    }),
});
