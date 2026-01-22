import type { Node } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

const builtins = new Set(
    "assert assert/strict async_hooks buffer child_process cluster console constants crypto dgram diagnostics_channel dns dns/promises domain events fs fs/promises http http2 https inspector inspector/promises module net os path path/posix path/win32 perf_hooks process punycode querystring readline readline/promises repl stream stream/consumers stream/promises stream/web string_decoder sys timers timers/promises tls trace_events tty url util util/types v8 vm wasi worker_threads zlib".split(
        " ",
    ),
);

export default rule({
    name: "useNodejsImportProtocol",
    group: "style",
    severity: "info",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    create: (context) => {
        const check = (source: Node | null | undefined) => {
            if (!source) return;
            const name = Nodes.string(source);
            if (name === undefined || !builtins.has(name)) return;
            context.report(
                source,
                "A Node.js builtin module should be imported with the node: protocol.",
                {
                    message: "Add the node: protocol.",
                    edits: [
                        {
                            start: source.start + 1,
                            end: source.start + 1,
                            text: "node:",
                        },
                    ],
                },
            );
        };
        return {
            ImportDeclaration: (node) => check(node.source),
            ExportNamedDeclaration: (node) => check(node.source),
            ExportAllDeclaration: (node) => check(node.source),
            ImportExpression: (node) => check(node.source),
            CallExpression(node) {
                if (
                    node.callee.type === "Identifier" &&
                    node.callee.name === "require" &&
                    node.arguments.length === 1 &&
                    context.semantic.isGlobal(node.callee)
                )
                    check(node.arguments[0]);
            },
        };
    },
});
