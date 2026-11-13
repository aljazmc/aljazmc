/**
 * A glob of paths relative to the root, like `.gitignore`'s: one without a
 * `/` matches a file or folder of that name anywhere, one with a `/` a path
 * from the root, also when it starts with `/` or `./`, and one that ends
 * with `/` only folders. A folder that matches also matches its contents.
 */
export default class Pattern {
    readonly #anchored: boolean;
    readonly #directories: boolean;
    readonly #regex: RegExp;

    /** With the name of the setting the glob comes from, for its errors. */
    constructor(source: string, setting = "glob") {
        this.#directories = /[^/]\/+$/.test(source);
        const glob = source.replace(/^\.?\/+|\/+$/g, "");
        this.#anchored = glob.includes("/") || /^\.?\//.test(source);
        this.#regex = new RegExp(
            `^${Pattern.#toRegex(glob, source, setting)}$`,
        );
    }

    /**
     * Whether a path, or a folder it is in, matches. Whether the path itself
     * is a folder matters to globs ending with `/`.
     */
    matches(path: string, directory = false): boolean {
        const segments = path.split("/");

        return segments.some((segment, index) => {
            // the folders a path is in are folders, the path only when told
            if (
                this.#directories &&
                index === segments.length - 1 &&
                !directory
            )
                return false;
            return this.#regex.test(
                this.#anchored
                    ? segments.slice(0, index + 1).join("/")
                    : segment,
            );
        });
    }

    /** Translates `**`, `*`, `?` and `{a,b}` alternatives, other characters match themselves. */
    static #toRegex(glob: string, source: string, setting: string): string {
        const tokens: Record<string, string> = {
            "**/": "(?:.*/)?",
            "**": ".*",
            "*": "[^/]*",
            "?": "[^/]",
        };
        let regex = "";
        let braces = 0;

        for (const [token] of glob.matchAll(/\*\*\/|\*\*|[\s\S]/g)) {
            if (Object.hasOwn(tokens, token)) regex += tokens[token];
            else if (token === "{") {
                braces++;
                regex += "(?:";
            } else if (token === "}" && braces > 0) {
                braces--;
                regex += ")";
            } else if (token === "," && braces > 0) regex += "|";
            else regex += token.replace(/[.+^${}()|[\]\\]/g, "\\$&");
        }
        if (braces > 0)
            throw new Error(
                `Invalid ${setting} ${JSON.stringify(source)}: a { is not closed by a }.`,
            );

        return regex;
    }
}
