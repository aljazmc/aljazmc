import type { Comment, Lines } from "@aljazmc/syntax";
import type { Group } from "../rules.js";

/** A `biome-ignore` (or `lintero-ignore`) comment, for lint categories, `<!-- -->` ones in Markdown. */
export interface Suppression {
    comment: Comment;
    /** Categories like `lint`, `lint/style` or `lint/style/useConst`. */
    categories: string[];
    /** Per category, the instance it is limited to, like the dependency in `useExhaustiveDependencies(a)`. */
    instances: (string | undefined)[];
    /** First and last suppressed lines, 1-based. */
    from: number;
    to: number;
    used: boolean;
}

export interface SuppressionError {
    start: number;
    end: number;
    message: string;
}

/** Suppression comments of a file, matched against diagnostics by line. */
export default class Suppressions {
    static readonly #groups: Group[] = [
        "a11y",
        "complexity",
        "correctness",
        "nursery",
        "performance",
        "security",
        "style",
        "suspicious",
    ];
    static readonly #example =
        "Example of suppression: // biome-ignore lint: reason";

    readonly suppressions: Suppression[] = [];
    readonly errors: SuppressionError[] = [];

    constructor(comments: Comment[], lines: Lines, text: string) {
        const starts: Suppression[] = [];

        for (const comment of comments) {
            const html = comment.value.startsWith("<!--");
            const body =
                comment.type === "Line"
                    ? comment.value.slice(2)
                    : html
                      ? comment.value.slice(4, -3)
                      : comment.value.slice(2, -2);
            const match =
                /^\s*(?:biome|lintero)-ignore(-all|-start|-end)?(?=\s|$)/.exec(
                    body,
                );
            if (!match) continue;

            const offset = comment.start + (html ? 4 : 2) + match[0].length;
            const parsed = this.#categories(
                body.slice(match[0].length),
                offset,
            );
            if (!parsed) continue;
            const { categories, instances } = parsed;

            const line = lines.line(comment.start);
            const kind = match[1];
            const suppression: Suppression = {
                comment,
                categories,
                instances,
                from: line,
                to: line,
                used: false,
            };

            if (kind === "-all") {
                suppression.from = 1;
                suppression.to = Number.POSITIVE_INFINITY;
            } else if (kind === "-start") {
                starts.push(suppression);
                suppression.to = Number.POSITIVE_INFINITY;
            } else if (kind === "-end") {
                const start = starts.findLast((open) =>
                    open.categories.every((category) =>
                        categories.includes(category),
                    ),
                );
                if (start) {
                    start.to = line;
                    starts.splice(starts.indexOf(start), 1);
                }
                continue;
            } else {
                // a comment suppresses the line its next token is on
                const next = Suppressions.#next(text, comment.end);
                suppression.from = suppression.to = lines.line(next);
            }

            this.suppressions.push(suppression);
        }
    }

    /** Whether a diagnostic of a category on a line is suppressed, marking the suppression used. */
    suppresses(category: string, line: number, instance?: string): boolean {
        let suppressed = false;

        for (const suppression of this.suppressions)
            if (
                line >= suppression.from &&
                line <= suppression.to &&
                suppression.categories.some(
                    (prefix, index) =>
                        (category === prefix ||
                            category.startsWith(`${prefix}/`)) &&
                        [undefined, instance].includes(
                            suppression.instances[index],
                        ),
                )
            ) {
                suppression.used = true;
                suppressed = true;
            }

        return suppressed;
    }

    /** Parses `lint/group/rule lint/other: reason`, reporting malformed ones. */
    #categories(
        text: string,
        offset: number,
    ): { categories: string[]; instances: (string | undefined)[] } | undefined {
        const categories: string[] = [];
        const instances: (string | undefined)[] = [];
        const pattern = /(\s*)([\w/]+)(?:\(([^)]*)\))?/y;
        let index = 0;
        let last = offset;

        while (index < text.length) {
            if (/^\s*:/.test(text.slice(index)))
                return { categories, instances };
            pattern.lastIndex = index;
            const match = pattern.exec(text);
            if (!match?.[2]) break;

            const category = match[2];
            const [kind, group] = category.split("/");
            last = offset + index + (match[1]?.length ?? 0);
            if (
                kind === "lint" &&
                group !== undefined &&
                !Suppressions.#groups.includes(group as Group)
            ) {
                this.#error(
                    last,
                    category.length,
                    `Failed to parse category "${category}".`,
                );
                return;
            }
            if (kind === "lint") {
                categories.push(category);
                instances.push(match[3]?.trim());
            }
            index = pattern.lastIndex;
        }

        this.#error(
            last,
            1,
            "Unexpected token, expected one of ':', '(' or whitespace.",
        );
    }

    #error(start: number, length: number, message: string): void {
        this.errors.push({
            start,
            end: start + length,
            message: `${message} ${Suppressions.#example}`,
        });
    }

    /** The start of the first token after a position, skipping comments. */
    static #next(text: string, from: number): number {
        const pattern = /\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/y;
        let index = from;
        pattern.lastIndex = index;
        while (pattern.exec(text)) index = pattern.lastIndex;
        return index;
    }
}
