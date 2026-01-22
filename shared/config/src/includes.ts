import Pattern from "./pattern.js";

/** Biome style `includes`: globs in order, the last one matching a file decides, `!` excludes. */
export default class Includes {
    readonly #globs: { pattern: Pattern; included: boolean }[];

    constructor(globs: readonly string[]) {
        this.#globs = globs.map((glob) => ({
            pattern: new Pattern(glob.replace(/^!/, "")),
            included: !glob.startsWith("!"),
        }));
    }

    matches(file: string): boolean {
        let included = false;

        for (const { pattern, included: positive } of this.#globs)
            if (pattern.matches(file)) included = positive;

        return included;
    }
}
