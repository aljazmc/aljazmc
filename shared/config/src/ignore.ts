import Pattern from "./pattern.js";

export default class Ignore {
    readonly #patterns: Pattern[];

    constructor(sources: readonly string[]) {
        this.#patterns = sources.map((source) => new Pattern(source, "ignore"));
    }

    /** Whether a path is ignored, globs ending with `/` only ignore folders. */
    matches(path: string, directory = false): boolean {
        const normalized = path.replaceAll("\\", "/").replace(/^\.\//, "");

        return this.#patterns.some((pattern) =>
            pattern.matches(normalized, directory),
        );
    }
}
