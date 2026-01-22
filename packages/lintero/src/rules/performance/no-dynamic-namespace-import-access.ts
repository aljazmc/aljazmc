import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noDynamicNamespaceImportAccess",
    group: "performance",
    severity: "warn",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        MemberExpression(node) {
            const object = Nodes.unwrap(node.object);
            if (!node.computed || object.type !== "Identifier") return;
            const [declaration] =
                context.semantic.referenced(object)?.binding?.declarations ??
                [];
            if (declaration?.node.type === "ImportNamespaceSpecifier")
                context.report(
                    node,
                    "Avoid accessing namespace imports dynamically, it can prevent efficient tree shaking and increase bundle size.",
                );
        },
    }),
});
