import type { Node } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import type { Binding } from "../../analysis/semantic.js";
import Vue from "../../analysis/vue.js";
import { rule } from "../../rules.js";

const creators = ["ref", "computed", "toRef", "shallowRef", "customRef"];

export default rule({
    name: "noVueRefAsOperand",
    group: "correctness",
    severity: "error",
    recommended: false,
    fix: "none",
    languages: ["js"],
    domains: { vue: "recommended" },
    create: (context) => {
        /** Whether a binding holds a ref, from `ref(...)`, `toRefs(...)` or another ref. */
        const isRef = (
            binding: Binding,
            seen = new Set<Binding>(),
        ): boolean => {
            if (seen.has(binding)) return false;
            seen.add(binding);
            const declaration = binding.declarations[0];
            const declarator = declaration?.node;
            if (
                !declaration ||
                declarator?.type !== "VariableDeclarator" ||
                !declarator.init
            )
                return false;
            const { init } = declarator;
            if (init.type === "CallExpression") {
                if (declarator.id === declaration.id)
                    return Vue.imported(context, init.callee, creators);
                return (
                    declarator.id.type === "ObjectPattern" &&
                    Vue.imported(context, init.callee, ["toRefs"])
                );
            }
            if (
                init.type === "Identifier" &&
                declarator.id === declaration.id
            ) {
                const aliased = context.semantic.referenced(init)?.binding;
                return aliased !== undefined && isRef(aliased, seen);
            }
            return false;
        };

        /** Whether a call emits an event from a component's `setup`, like `emit("x", value)`. */
        const emits = (call: Node): boolean => {
            if (call.type !== "CallExpression") return false;
            const name =
                call.callee.type === "Identifier"
                    ? call.callee.name
                    : Nodes.member(call.callee)?.name;
            if (name !== "emit") return false;
            return [...context.ancestors(call)].some(
                (ancestor) =>
                    (ancestor.type === "Property" ||
                        ancestor.type === "MethodDefinition") &&
                    Nodes.key(ancestor.key, ancestor.computed) === "setup",
            );
        };

        /** Whether a value is used as an operand, where its `.value` was meant. */
        const operand = (node: Node): boolean => {
            const parent = context.parent(node);
            switch (parent?.type) {
                case "BinaryExpression":
                    return parent.operator !== "instanceof";
                case "UnaryExpression":
                case "UpdateExpression":
                case "TemplateLiteral":
                    return true;
                case "AssignmentExpression":
                case "LogicalExpression":
                    return parent.left === node;
                case "ConditionalExpression":
                case "IfStatement":
                    return parent.test === node;
                case "SwitchStatement":
                    return parent.discriminant === node;
                case "MemberExpression":
                    return (
                        parent.object === node &&
                        !parent.computed &&
                        Nodes.key(parent.property) !== "value"
                    );
                case "CallExpression":
                    return parent.callee !== node && emits(parent);
                default:
                    return false;
            }
        };

        return {
            "Program:exit"() {
                for (const reference of context.semantic.references) {
                    const { binding, node } = reference;
                    if (
                        binding &&
                        !reference.type &&
                        operand(node) &&
                        isRef(binding)
                    )
                        context.report(
                            node,
                            "Ref value is accessed without `.value`.",
                        );
                }
            },
        };
    },
});
