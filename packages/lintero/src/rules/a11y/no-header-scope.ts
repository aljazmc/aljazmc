import Jsx from "../../analysis/jsx.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noHeaderScope",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "unsafe",
    languages: ["jsx"],
    create: (context) => ({
        JSXElement(node) {
            if (!Jsx.intrinsic(node) || node.name === "th") return;
            const scope = Jsx.attribute(node, "scope");
            if (scope)
                context.report(
                    scope,
                    "Avoid using the scope attribute on elements other than th elements.",
                    {
                        message: "Remove the scope attribute.",
                        edits: [
                            { start: scope.start, end: scope.end, text: "" },
                        ],
                    },
                );
        },
    }),
});
