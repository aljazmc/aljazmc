import type { Character, CharacterClass } from "../../analysis/regex.js";
import { parseRegex } from "../../analysis/regex.js";
import { rule } from "../../rules.js";

const combining = (value: number): boolean =>
    /\p{M}/u.test(String.fromCodePoint(value)) ||
    (value >= 0xfe00 && value <= 0xfe0f) ||
    (value >= 0xe0100 && value <= 0xe01ef);
const modifier = (value: number) => value >= 0x1f3fb && value <= 0x1f3ff;
const regional = (value: number) => value >= 0x1f1e6 && value <= 0x1f1ff;
const high = (value: number) => value >= 0xd800 && value <= 0xdbff;
const low = (value: number) => value >= 0xdc00 && value <= 0xdfff;

export default rule({
    name: "noMisleadingCharacterClass",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "safe",
    languages: ["js"],
    create: (context) => ({
        RegExpLiteral(node) {
            const parsed = parseRegex(node.raw);
            if (!parsed) return;

            /** The first character sequence a class cannot match, with its message. */
            const problem = (
                klass: CharacterClass,
            ):
                | { at: Character; message: string; surrogate?: boolean }
                | undefined => {
                const elements = klass.elements;
                for (const [index, element] of elements.entries()) {
                    if (element.type === "class") {
                        const inner = problem(element);
                        if (inner) return inner;
                        continue;
                    }
                    const previous = elements[index - 1];
                    if (
                        element.type !== "character" ||
                        previous?.type !== "character"
                    )
                        continue;
                    const { value } = element;
                    if (!parsed.unicode && high(previous.value) && low(value))
                        return {
                            at: previous,
                            message:
                                "A character class cannot match a surrogate pair. Add the 'u' unicode flag to match against them.",
                            surrogate: true,
                        };
                    if (combining(value))
                        return {
                            at: previous,
                            message:
                                "A character class cannot match a character and a combining character.",
                        };
                    if (parsed.unicode && modifier(value))
                        return {
                            at: previous,
                            message:
                                "A character class cannot match an emoji with a skin tone modifier.",
                        };
                    if (
                        parsed.unicode &&
                        regional(previous.value) &&
                        regional(value)
                    )
                        return {
                            at: previous,
                            message:
                                "A character class cannot match a pair of regional indicator symbols.",
                        };
                    const next = elements[index + 1];
                    if (value === 0x200d && next?.type === "character")
                        return {
                            at: previous,
                            message:
                                "A character class cannot match a joined character sequence.",
                        };
                }
            };

            for (const klass of parsed.classes) {
                const found = problem(klass);
                if (!found) continue;
                const start = node.start + 1 + found.at.start;
                context.report(
                    { start, end: start + (found.at.end - found.at.start) },
                    found.message,
                    found.surrogate
                        ? {
                              message: "Add unicode u flag to regex",
                              edits: [
                                  { start: node.end, end: node.end, text: "u" },
                              ],
                          }
                        : undefined,
                );
                return;
            }
        },
    }),
});
