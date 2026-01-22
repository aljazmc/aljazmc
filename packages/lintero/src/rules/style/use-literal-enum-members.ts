import type { Node } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

export default rule({
    name: "useLiteralEnumMembers",
    group: "style",
    severity: "warn",
    recommended: true,
    fix: "none",
    languages: ["ts"],
    create: (context) => ({
        TSEnumDeclaration(node) {
            const previous = new Set<string>();
            const enumName = node.id.name;

            /** Literals, previous members and numeric or bitwise expressions of them. */
            const constant = (value: Node): boolean => {
                const current = Nodes.unwrap(value);
                switch (current.type) {
                    case "NumericLiteral":
                    case "StringLiteral":
                        return true;
                    case "TemplateLiteral":
                        return current.expressions.length === 0;
                    case "Identifier":
                        return previous.has(current.name);
                    case "MemberExpression": {
                        const name = Nodes.key(
                            current.property,
                            current.computed,
                        );
                        return (
                            current.object.type === "Identifier" &&
                            current.object.name === enumName &&
                            name !== undefined &&
                            previous.has(name)
                        );
                    }
                    case "UnaryExpression":
                        return (
                            ["-", "+", "~"].includes(current.operator) &&
                            constant(current.argument)
                        );
                    case "BinaryExpression":
                        return (
                            constant(current.left) && constant(current.right)
                        );
                    default:
                        return false;
                }
            };

            for (const member of node.members) {
                if (member.initializer && !constant(member.initializer))
                    context.report(
                        member.initializer,
                        "The enum member should be initialized with a literal value such as a number or a string.",
                    );
                const name = Nodes.key(member.id);
                if (name !== undefined) previous.add(name);
            }
        },
    }),
});
