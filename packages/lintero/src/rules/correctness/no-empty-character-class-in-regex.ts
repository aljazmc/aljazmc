import { rule } from "../../rules.js";

export default rule({
    name: "noEmptyCharacterClassInRegex",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        RegExpLiteral(node) {
            const body = node.raw.slice(1, node.raw.lastIndexOf("/"));

            for (let index = 0; index < body.length; index++) {
                const char = body[index];
                if (char === "\\") {
                    index++;
                    continue;
                }
                if (char !== "[") continue;

                const start = index;
                const negated = body[index + 1] === "^";
                index += negated ? 2 : 1;
                if (body[index] === "]") {
                    context.report(
                        {
                            start: node.start + 1 + start,
                            end: node.start + 2 + index,
                        },
                        negated
                            ? "The regular expression includes this negated empty character class."
                            : "The regular expression includes this empty character class.",
                    );
                    continue;
                }
                // skip to the end of the class
                while (index < body.length && body[index] !== "]") {
                    if (body[index] === "\\") index++;
                    index++;
                }
            }
        },
    }),
});
