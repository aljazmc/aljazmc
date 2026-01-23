import type { Shared } from "../rules.js";

/**
 * Reindents text without known structure: a tab is one level, spaces are
 * measured by the most frequent indentation step of space indented lines.
 */
export default class TextIndentation {
    readonly #unit: string;
    readonly #width: number;

    constructor({
        indentStyle,
        indentWidth,
    }: Pick<Shared, "indentStyle" | "indentWidth">) {
        this.#unit = indentStyle === "tab" ? "\t" : " ".repeat(indentWidth);
        this.#width = indentWidth;
    }

    format(source: string): string {
        const step = this.#step(source);

        return source.replace(/^[ \t]+(?=\S)/gm, (indent) => {
            const tabs = indent.split("\t").length - 1;
            const spaces = indent.length - tabs;

            return (
                this.#unit.repeat(tabs + Math.floor(spaces / step)) +
                " ".repeat(spaces % step)
            );
        });
    }

    /** Most frequent indentation step, larger wins ties. */
    #step(source: string): number {
        const steps = new Map<number, number>();
        let previous = 0;

        for (const [indent = ""] of source.matchAll(/^[ \t]*(?=\S)/gm)) {
            if (indent.includes("\t")) continue;

            const step = indent.length - previous;
            if (step > 0) steps.set(step, (steps.get(step) ?? 0) + 1);
            previous = indent.length;
        }

        const [[step] = [this.#width]] = [...steps].sort(
            ([a, x], [b, y]) => y - x || b - a,
        );

        return step;
    }
}
