import { type Node, Walker } from "@aljazmc/syntax";
import Functions from "../../analysis/functions.js";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

const loops = [
    "DoWhileStatement",
    "ForInStatement",
    "ForOfStatement",
    "ForStatement",
    "SwitchStatement",
    "WhileStatement",
];

/** Whether a hook call like `useState()` or `React.useState()`. */
const isHook = (node: Node, ignored: string[]): boolean => {
    if (node.type !== "CallExpression") return false;
    const name =
        node.callee.type === "Identifier"
            ? node.callee.name
            : Nodes.member(node.callee)?.name;
    return (
        name !== undefined && Functions.hook(name) && !ignored.includes(name)
    );
};

export default rule<{ ignore?: string[] }>({
    name: "useHookAtTopLevel",
    group: "correctness",
    severity: "error",
    recommended: false,
    fix: "none",
    languages: ["js"],
    domains: { react: "recommended", next: "recommended" },
    options: { ignore: [] },
    create: (context) => {
        /** Whether a child runs only under some condition of its parent. */
        const conditional = (child: Node, parent: Node): boolean => {
            switch (parent.type) {
                case "LogicalExpression":
                    return parent.right === child;
                case "ConditionalExpression":
                case "IfStatement":
                    return parent.test !== child;
                case "TryStatement":
                    return parent.finalizer !== child;
                case "AssignmentPattern": {
                    // defaults of destructured values, not of parameters
                    const pattern = context.parent(parent);
                    return (
                        parent.right === child &&
                        pattern !== undefined &&
                        !Nodes.isFunction(pattern)
                    );
                }
                default:
                    return loops.includes(parent.type);
            }
        };

        /** Whether a return in the function may run before the call. */
        const returnsBefore = (fn: Node, call: Node): boolean => {
            const visit = (node: Node): boolean => {
                if (node !== fn && Nodes.isFunction(node)) return false;
                if (node.start >= call.start) return false;
                if (node.type === "ReturnStatement" && node.end <= call.start)
                    return true;
                for (const child of Walker.children(node))
                    if (visit(child)) return true;
                return false;
            };
            return visit(fn);
        };

        return {
            CallExpression(node) {
                if (!isHook(node, context.options.ignore ?? [])) return;
                const functions = [...context.ancestors(node)].filter(
                    (ancestor) => Nodes.isFunction(ancestor),
                );
                const [fn, ...outer] = functions;
                if (!fn) {
                    context.report(
                        node,
                        "This hook is being called at the module level, but all hooks must be called from within a hook or component.",
                    );
                    return;
                }
                if (
                    outer.some((ancestor) =>
                        Functions.componentOrHook(context, ancestor),
                    )
                ) {
                    context.report(
                        node,
                        "This hook is being called from a nested function, but all hooks must be called unconditionally from the top-level component.",
                    );
                    return;
                }
                if (
                    Functions.method(context, fn) ||
                    (fn.type === "FunctionDeclaration" &&
                        !Functions.componentOrHook(context, fn))
                ) {
                    context.report(
                        node,
                        "This hook is being called from within a function or method that is not a hook or component.",
                    );
                    return;
                }

                let child: Node = node;
                let isConditional = false;
                for (const ancestor of context.ancestors(node)) {
                    if (ancestor === fn) break;
                    if (conditional(child, ancestor)) isConditional = true;
                    child = ancestor;
                }
                if (isConditional || returnsBefore(fn, node))
                    context.report(
                        node,
                        "This hook is being called conditionally, but all hooks must be called in the exact same order in every component render.",
                    );
            },
        };
    },
});
