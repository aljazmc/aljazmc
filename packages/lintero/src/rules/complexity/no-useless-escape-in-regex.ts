import {
    type Character,
    type CharacterClass,
    parseRegex,
} from "../../analysis/regex.js";
import { rule } from "../../rules.js";

/** Characters an escape gives a meaning to, outside of classes. */
const syntax = "^$\\.*+?()[]{}|/";
const meaningful = "bBdDsSwWfnrtvcxuk0123456789";
/** In classes, `\b` is a backspace and digits other than `\0` are not backreferences. */
const meaningfulInClass = "bdDsSwWfnrtvcxu0";
/** Characters that need escapes in `v` mode classes. */
const reservedInSets = "()[]{}/-\\|&!#%,:;<=>@`~^";

export default rule({
    name: "noUselessEscapeInRegex",
    group: "complexity",
    severity: "info",
    recommended: true,
    fix: "safe",
    languages: ["js"],
    create: (context) => ({
        RegExpLiteral(node) {
            const parsed = parseRegex(node.raw);
            if (!parsed) return;
            const report = (character: Character) => {
                const start = node.start + 1 + character.start;
                context.report(
                    { start, end: node.start + 1 + character.end },
                    "The character doesn't need to be escaped.",
                    {
                        message: "Unescape the character.",
                        edits: [{ start, end: start + 1, text: "" }],
                    },
                );
            };

            for (const character of parsed.escapes)
                if (
                    [...character.raw].length === 1 &&
                    !syntax.includes(character.raw) &&
                    !meaningful.includes(character.raw)
                )
                    report(character);

            const visit = (klass: CharacterClass) => {
                for (const [index, element] of klass.elements.entries()) {
                    if (element.type === "class") {
                        visit(element);
                        continue;
                    }
                    if (element.type !== "character" || !element.escaped)
                        continue;
                    const char = element.raw;
                    if ([...char].length !== 1) continue;
                    if (parsed.unicodeSets) {
                        if (
                            !reservedInSets.includes(char) &&
                            !meaningfulInClass.includes(char)
                        )
                            report(element);
                        continue;
                    }
                    if (
                        char === "\\" ||
                        char === "]" ||
                        meaningfulInClass.includes(char)
                    )
                        continue;
                    // a caret first in the class would negate it
                    if (char === "^" && index === 0 && !klass.negate) continue;
                    // a dash between two characters would make a range
                    const previous = klass.elements[index - 1];
                    const next = klass.elements[index + 1];
                    if (
                        char === "-" &&
                        previous &&
                        previous.type !== "operator" &&
                        klass.elements[index - 2]?.type !== "operator" &&
                        next &&
                        next.type !== "operator"
                    )
                        continue;
                    report(element);
                }
            };
            for (const klass of parsed.classes)
                if (
                    !parsed.classes.some(
                        (outer) =>
                            outer !== klass && outer.elements.includes(klass),
                    )
                )
                    visit(klass);
        },
    }),
});
