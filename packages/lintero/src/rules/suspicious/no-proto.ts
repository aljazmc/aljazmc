import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noProto",
    group: "suspicious",
    severity: "warn",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        MemberExpression(node) {
            if (Nodes.key(node.property, node.computed) === "__proto__")
                context.report(
                    node,
                    "Avoid use of the deprecated __proto__ accessor.",
                );
        },
    }),
});
