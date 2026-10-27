import { rule } from "../../rules.js";

export default rule<{ allowedLanguages?: string[]; languageOnly?: boolean }>({
    name: "useFencedCodeLanguage",
    group: "nursery",
    severity: "info",
    recommended: true,
    fix: "none",
    languages: ["md"],
    options: { allowedLanguages: [], languageOnly: false },
    create: (context) => ({
        CodeBlock(node) {
            if (!node.fence) return;
            const { allowedLanguages = [], languageOnly } = context.options;
            if (!node.info) {
                context.report(
                    { start: node.start, end: node.start + node.fence.length },
                    "This fenced code block is missing a language tag.",
                );
                return;
            }
            // the info string as written, after the fence
            const after = node.start + node.fence.length;
            const line = /^[^\r\n]*/.exec(context.text.slice(after))?.[0] ?? "";
            const start = after + line.length - line.trimStart().length;
            const language = node.info.split(/\s/)[0] ?? "";
            const end = start + language.length;
            if (
                allowedLanguages.length > 0 &&
                !allowedLanguages.includes(language)
            )
                context.report(
                    { start, end },
                    "This language tag isn't in the list of allowed languages.",
                );
            if (languageOnly && node.info.length > language.length)
                context.report(
                    { start: end, end: start + node.info.length },
                    "This info string contains content beyond the language tag.",
                );
        },
    }),
});
