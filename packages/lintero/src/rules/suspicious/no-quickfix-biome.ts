import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

const settings = [
    ".vscode/settings.json",
    "Code/User/settings.json",
    ".zed/settings.json",
    "zed/settings.json",
];

export default rule<{ additionalPaths?: string[] }>({
    name: "noQuickfixBiome",
    group: "suspicious",
    severity: "info",
    recommended: true,
    fix: "safe",
    languages: ["json"],
    options: { additionalPaths: [] },
    create: (context) => {
        const file = `/${context.file.replaceAll("\\", "/")}`;
        const paths = [...settings, ...(context.options.additionalPaths ?? [])];
        if (!paths.some((path) => file.endsWith(`/${path}`))) return {};
        return {
            Property(node) {
                if (Nodes.key(node.key) === "quickfix.biome")
                    context.report(
                        node.key,
                        "The use of quickfix.biome is deprecated.",
                        {
                            message: "Use source.fixAll.biome instead.",
                            edits: [
                                {
                                    start: node.key.start,
                                    end: node.key.end,
                                    text: '"source.fixAll.biome"',
                                },
                            ],
                        },
                    );
            },
        };
    },
});
