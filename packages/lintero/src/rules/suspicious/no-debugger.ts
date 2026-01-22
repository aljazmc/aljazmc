import { rule } from "../../rules.js";

export default rule({
    name: "noDebugger",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    create: (context) => ({
        DebuggerStatement(node) {
            const parent = context.parent(node);
            const list =
                parent?.type === "BlockStatement" ||
                parent?.type === "Program" ||
                parent?.type === "SwitchCase" ||
                parent?.type === "StaticBlock";
            context.report(
                node,
                "This is an unexpected use of the debugger statement.",
                {
                    message: "Remove debugger statement",
                    edits: [
                        {
                            start: node.start,
                            end: node.end,
                            text: list ? "" : "{}",
                        },
                    ],
                },
            );
        },
    }),
});
