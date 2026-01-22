import type { Edit } from "../../rules.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noAdjacentSpacesInRegex",
    group: "complexity",
    severity: "warn",
    recommended: true,
    fix: "safe",
    languages: ["js"],
    create: (context) => ({
        RegExpLiteral(node) {
            const body = node.raw.slice(1, node.raw.lastIndexOf("/"));
            const edits: Edit[] = [];
            let inClass = false;

            for (let index = 0; index < body.length; index++) {
                const char = body[index];
                if (char === "\\") index++;
                else if (char === "[") inClass = true;
                else if (char === "]") inClass = false;
                else if (char === " " && !inClass) {
                    let end = index;
                    while (body[end] === " ") end++;
                    const count = end - index;
                    if (count > 1) {
                        // a quantifier applies to the last space only
                        const quantified = /^[*+?{]/.test(body.slice(end));
                        const start = node.start + 1 + index;
                        edits.push({
                            start,
                            end: start + count,
                            text: quantified
                                ? ` {${count - 1}} `
                                : ` {${count}}`,
                        });
                    }
                    index = end - 1;
                }
            }

            const first = edits[0];
            const last = edits.at(-1);
            if (!first || !last) return;
            context.report(
                { start: first.start, end: last.end },
                "This regular expression contains unclear uses of consecutive spaces.",
                { message: "Use a quantifier instead.", edits },
            );
        },
    }),
});
