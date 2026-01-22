import Jsx from "../../analysis/jsx.js";
import { rule } from "../../rules.js";

export default rule<{ allowDomains?: string[]; allowNoReferrer?: boolean }>({
    name: "noBlankTarget",
    group: "security",
    severity: "error",
    recommended: true,
    fix: "safe",
    languages: ["jsx"],
    options: { allowDomains: [], allowNoReferrer: true },
    create: (context) => ({
        JSXElement(node) {
            if (!["a", "area", "form"].includes(node.name ?? "")) return;
            const target = Jsx.attribute(node, "target");
            if (!target || String(Jsx.value(target)).toLowerCase() !== "_blank")
                return;

            const href = Jsx.attribute(
                node,
                node.name === "form" ? "action" : "href",
            );
            const url = href ? Jsx.value(href) : undefined;
            if (
                typeof url === "string" &&
                context.options.allowDomains?.some((domain) =>
                    url.startsWith(domain),
                )
            )
                return;

            const rel = Jsx.attribute(node, "rel");
            // spread props after rel or target may set them
            const last = node.attributes.at(-1);
            if (
                last?.type === "JSXSpreadAttribute" &&
                node.attributes.indexOf(last) > node.attributes.indexOf(target)
            )
                return;
            const value = rel ? Jsx.value(rel) : undefined;
            if (Jsx.dynamic(value)) return;
            const words =
                typeof value === "string"
                    ? value.toLowerCase().split(/\s+/)
                    : [];
            const referrer = context.options.allowNoReferrer !== false;
            if (
                words.includes("noopener") ||
                (referrer && words.includes("noreferrer"))
            )
                return;
            context.report(
                target,
                referrer
                    ? 'Avoid using target="_blank" without rel="noopener" or rel="noreferrer".'
                    : 'Avoid using target="_blank" without rel="noopener".',
            );
        },
    }),
});
