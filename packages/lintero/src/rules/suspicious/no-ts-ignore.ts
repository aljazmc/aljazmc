import { rule } from "../../rules.js";

export default rule({
    name: "noTsIgnore",
    group: "suspicious",
    severity: "warn",
    recommended: true,
    fix: "safe",
    languages: ["js"],
    create: (context) => ({
        Program() {
            for (const comment of context.comments) {
                const match = /^(\/\/\/?|\/\*+)\s*(@ts-ignore)/.exec(
                    comment.value,
                );
                if (!match?.[1]) continue;
                const start =
                    comment.start + match[0].length - "@ts-ignore".length;
                context.report(
                    { start, end: start + "@ts-ignore".length },
                    "Unsafe use of the @ts-ignore directive found in this comment.",
                    {
                        message: "Use the @ts-expect-error directive instead.",
                        edits: [
                            {
                                start,
                                end: start + "@ts-ignore".length,
                                text: "@ts-expect-error",
                            },
                        ],
                    },
                );
            }
        },
    }),
});
