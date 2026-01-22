import { rule } from "../../rules.js";

export default rule({
    name: "noConstEnum",
    group: "suspicious",
    severity: "warn",
    recommended: true,
    fix: "safe",
    languages: ["ts"],
    create: (context) => ({
        TSEnumDeclaration(node) {
            if (!node.const) return;
            const keyword = context.find("const", node.start, node.id.start);
            context.report(node, "The enum declaration should not be const", {
                message: "Turn the const enum into a regular enum.",
                edits: [
                    {
                        start: keyword.start,
                        end: context.token(keyword.end).start,
                        text: "",
                    },
                ],
            });
        },
    }),
});
