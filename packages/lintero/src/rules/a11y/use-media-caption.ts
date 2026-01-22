import Jsx from "../../analysis/jsx.js";
import { rule } from "../../rules.js";

export default rule({
    name: "useMediaCaption",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["jsx"],
    create: (context) => ({
        JSXElement(node) {
            if (node.name !== "audio" && node.name !== "video") return;
            if (Jsx.attribute(node, "muted") || Jsx.spreads(node)) return;
            const captioned = node.children.some((child) => {
                if (child.type !== "JSXElement" || child.name !== "track")
                    return false;
                const kind = Jsx.attribute(child, "kind");
                return (
                    kind !== undefined &&
                    String(Jsx.value(kind)).toLowerCase() === "captions"
                );
            });
            if (!captioned)
                context.report(
                    node,
                    "Provide a track for captions when using audio or video elements.",
                );
        },
    }),
});
