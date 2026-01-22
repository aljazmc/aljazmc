import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

export default rule({
    name: "useFlatMap",
    group: "complexity",
    severity: "info",
    recommended: true,
    fix: "safe",
    languages: ["js"],
    create: (context) => ({
        CallExpression(node) {
            const flat = Nodes.member(node.callee);
            if (flat?.name !== "flat" || node.arguments.length > 1) return;
            const [depth] = node.arguments;
            if (
                depth &&
                !(
                    depth.type === "NumericLiteral" &&
                    Nodes.number(depth.raw) === 1
                )
            )
                return;
            const map = Nodes.unwrap(flat.object);
            if (map.type !== "CallExpression" || map.arguments.length !== 1)
                return;
            const member = Nodes.member(map.callee);
            if (member?.name !== "map") return;
            context.report(
                node,
                "The call chain .map().flat() can be replaced with a single .flatMap() call.",
            );
        },
    }),
});
