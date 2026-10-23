import type { Node } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

/** Variables always allowed, as anchored patterns. */
const defaults = [
    "CI",
    "HOME",
    "PATH",
    "PWD",
    "SHELL",
    "TZ",
    "USER",
    "NODE_ENV",
    "NEXT_PUBLIC_.*",
    "VITE_.*",
    "REACT_APP_.*",
    "VUE_APP_.*",
    "NUXT_.*",
    "GATSBY_.*",
    "EXPO_PUBLIC_.*",
    "VERCEL",
    "VERCEL_.*",
];

interface Turbo {
    globalEnv?: string[];
    globalPassThroughEnv?: string[];
    tasks?: Record<string, { env?: string[]; passThroughEnv?: string[] }>;
}

/** Variables declared in turbo.json, globally and per task, as anchored patterns. */
const declared = (turbo: Turbo): string[] => {
    const names = [
        ...(turbo.globalEnv ?? []),
        ...(turbo.globalPassThroughEnv ?? []),
        ...Object.values(turbo.tasks ?? {}).flatMap((task) => [
            ...(task.env ?? []),
            ...(task.passThroughEnv ?? []),
        ]),
    ];
    return names.map((name) =>
        name.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*"),
    );
};

export default rule<{ allowedEnvVars?: string[] }>({
    name: "noUndeclaredEnvVars",
    group: "suspicious",
    severity: "warn",
    recommended: false,
    fix: "none",
    languages: ["js"],
    domains: { turborepo: "recommended" },
    options: { allowedEnvVars: [] },
    create: (context) => {
        const turbo = context.project.turbo;
        if (typeof turbo !== "object" || turbo === null) return {};
        const allowed = [
            ...defaults,
            ...declared(turbo as Turbo),
            ...(context.options.allowedEnvVars ?? []),
        ].map((pattern) => new RegExp(`^(?:${pattern})$`));

        const check = (node: Node, name: string | undefined) => {
            if (
                name === undefined ||
                allowed.some((pattern) => pattern.test(name))
            )
                return;
            context.report(
                node,
                `The environment variable ${name} is not listed as a dependency in turbo.json.`,
            );
        };
        /** Whether a node is `process.env`, `import.meta.env` or `Bun.env`, also as a property like `window.process.env`. */
        const isEnv = (node: Node): boolean => {
            if (
                node.type !== "MemberExpression" ||
                Nodes.key(node.property, node.computed) !== "env"
            )
                return false;
            const { object } = node;
            if (object.type === "MetaProperty") return true;
            const name =
                object.type === "Identifier"
                    ? object.name
                    : Nodes.member(object)?.name;
            return name === "process" || name === "Bun";
        };

        return {
            MemberExpression(node) {
                if (!isEnv(node.object)) return;
                const parent = context.parent(node);
                if (
                    parent?.type === "AssignmentExpression" &&
                    parent.left === node
                )
                    return;
                check(node, Nodes.key(node.property, node.computed));
            },
            CallExpression(node) {
                if (Nodes.path(node.callee) === "Deno.env.get")
                    check(node, Nodes.string(node.arguments[0]));
            },
        };
    },
});
