import Pattern from "./pattern.js";

/** `includes`: globs in order, the last one matching a file decides, `!` excludes. */
export default class Includes {
    readonly #globs: { pattern: Pattern; included: boolean }[];

    /** With the name of the setting the globs come from, for their errors. */
    constructor(globs: readonly string[], setting = "includes") {
        this.#globs = globs.map((glob) => ({
            pattern: new Pattern(glob.replace(/^!/, ""), setting),
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
