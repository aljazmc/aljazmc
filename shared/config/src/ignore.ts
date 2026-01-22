import Pattern from "./pattern.js";

export default class Ignore {
    readonly #patterns: Pattern[];

    constructor(sources: readonly string[]) {
        this.#patterns = sources.map((source) => new Pattern(source));
    }

    matches(path: string): boolean {
        const normalized = path.replaceAll("\\", "/").replace(/^\.\//, "");

        return this.#patterns.some((pattern) => pattern.matches(normalized));
    }
}
