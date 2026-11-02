import {
    attribute,
    semanticElements,
    semanticExceptions,
    text,
    tokens,
} from "../../analysis/aria.js";
import Html from "../../analysis/html.js";
import Jsx from "../../analysis/jsx.js";
import { fromRoles, role as roleData } from "../../analysis/roles.js";
import { rule } from "../../rules.js";

export default rule({
    name: "useSemanticElements",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["html", "jsx"],
    create: (context) => ({
        JSXElement(node) {
            // custom elements like <my-element> have no semantic alternatives
            if (!Jsx.intrinsic(node) || node.name?.includes("-")) return;
            const role = attribute(node, "role");
            const value = text(role);
            if (!role || value === undefined || semanticExceptions.has(value))
                return;
            const [first] = tokens(value);
            const elements =
                first === undefined ? undefined : semanticElements[first];
            if (!elements) return;
            // already one of them, like <input type="checkbox" role="checkbox">
            const matches = elements.some((element) => {
                const [name, condition] = element.split(" ");
                if (name !== node.name) return false;
                if (!condition) return true;
                const [key, quoted] = condition.split("=");
                return (
                    text(attribute(node, key ?? "")) === quoted?.slice(1, -1)
                );
            });
            if (matches) return;
            context.report(
                role,
                `The elements with this role can be changed to the following elements:\n${elements.map((element) => `<${element}>`).join("\n")}`,
            );
        },
        HtmlElement(node) {
            const attribute = Html.attribute(node, "role");
            const value = Html.value(attribute)?.trim();
            if (!attribute || value === undefined) return;
            const role = fromRoles(value);
            if (role === undefined) return;
            if (
                [
                    "img",
                    "combobox",
                    "listbox",
                    "option",
                    "status",
                    "alert",
                ].includes(role)
            )
                return;
            const data = roleData(role);
            const instances = [...(data?.base ?? []), ...(data?.related ?? [])];
            if (instances.length === 0) return;
            const semantic = instances.some(
                (instance) =>
                    node.tag === instance.element &&
                    instance.attributes.every(
                        ([name, expected]) =>
                            Html.value(
                                Html.attribute(node, name),
                            )?.toLowerCase() === expected.toLowerCase(),
                    ),
            );
            if (!semantic)
                context.report(
                    attribute,
                    "The elements with this role can be changed to semantic elements.",
                );
        },
    }),
});
