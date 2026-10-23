import Json from "../../analysis/json.js";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

export default rule({
    name: "useBiomeIgnoreFolder",
    group: "suspicious",
    severity: "warn",
    recommended: true,
    fix: "safe",
    languages: ["json"],
    create: (context) => ({
        "Program:exit"(program) {
            if (!Json.biome(context.file)) return;
            for (const pattern of Json.includes(program)) {
                const value = Nodes.string(pattern) ?? "";
                if (!value.startsWith("!") || !value.endsWith("/**")) continue;
                context.report(
                    pattern,
                    "Incorrect usage of ignore a folder found.",
                    {
                        message:
                            "Remove the trailing /** to ignore the folder itself.",
                        edits: [
                            {
                                start: pattern.end - 4,
                                end: pattern.end - 1,
                                text: "",
                            },
                        ],
                    },
                );
            }
        },
    }),
});
