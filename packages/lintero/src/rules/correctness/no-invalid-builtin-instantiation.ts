import { rule } from "../../rules.js";

const withNew = new Set([
    "ArrayBuffer",
    "BigInt64Array",
    "BigUint64Array",
    "DataView",
    "FinalizationRegistry",
    "Float32Array",
    "Float64Array",
    "Int16Array",
    "Int32Array",
    "Int8Array",
    "Map",
    "Promise",
    "Proxy",
    "Set",
    "SharedArrayBuffer",
    "Uint16Array",
    "Uint32Array",
    "Uint8Array",
    "Uint8ClampedArray",
    "WeakMap",
    "WeakRef",
    "WeakSet",
]);
const withoutNew = new Set(["BigInt", "Symbol"]);

export default rule({
    name: "noInvalidBuiltinInstantiation",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    create: (context) => ({
        NewExpression(node) {
            const { callee } = node;
            if (
                callee.type !== "Identifier" ||
                !withoutNew.has(callee.name) ||
                !context.semantic.isGlobal(callee)
            )
                return;
            context.report(
                node,
                `Use ${callee.name}() instead of new ${callee.name}().`,
                {
                    message: "Remove new.",
                    edits: [{ start: node.start, end: callee.start, text: "" }],
                },
            );
        },
        CallExpression(node) {
            const { callee } = node;
            if (
                callee.type !== "Identifier" ||
                !withNew.has(callee.name) ||
                !context.semantic.isGlobal(callee)
            )
                return;
            context.report(
                node,
                `Use new ${callee.name}() instead of ${callee.name}().`,
                {
                    message: "Add new.",
                    edits: [
                        { start: node.start, end: node.start, text: "new " },
                    ],
                },
            );
        },
    }),
});
