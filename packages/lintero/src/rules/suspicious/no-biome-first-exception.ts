import Json from "../../analysis/json.js";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noBiomeFirstException",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "safe",
    languages: ["json"],
    create: (context) => ({
        "Program:exit"(program) {
            const root = Json.root(program);
            // extended configurations may include files first, nested ones are not checked
            if (
                !Json.biome(context.file) ||
                Json.member(root, "extends") ||
                Json.member(root, "root")?.type === "BooleanLiteral"
            )
                return;
            const [first] = Json.includes(program);
            if (first && Nodes.string(first)?.startsWith("!"))
                context.report(
                    first,
                    "Incorrect usage of the exception detected.",
                    {
                        message: 'Add the pattern "**" before the exceptions.',
                        edits: [
                            {
                                start: first.start,
                                end: first.start,
                                text: '"**", ',
                            },
                        ],
                    },
                );
        },
    }),
});
