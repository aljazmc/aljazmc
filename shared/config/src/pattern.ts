export default class Pattern {
    readonly #anchored: boolean;
    readonly #regex: RegExp;

    constructor(source: string) {
        const glob = source.replace(/^\.?\/+|\/+$/g, "");
        this.#anchored = glob.includes("/");
        this.#regex = new RegExp(`^${Pattern.#toRegex(glob)}$`);
    }

    matches(path: string): boolean {
        const segments = path.split("/");

        return segments.some((segment, index) =>
            this.#regex.test(
                this.#anchored
                    ? segments.slice(0, index + 1).join("/")
                    : segment,
            ),
        );
    }

    /** Translates `**`, `*`, `?` and `{a,b}` alternatives, other characters match themselves. */
    static #toRegex(glob: string): string {
        const tokens: Record<string, string> = {
            "**/": "(?:.*/)?",
            "**": ".*",
            "*": "[^/]*",
            "?": "[^/]",
        };
        let regex = "";
        let braces = 0;

        for (const [token] of glob.matchAll(/\*\*\/|\*\*|[\s\S]/g)) {
            if (token in tokens) regex += tokens[token] ?? token;
            else if (token === "{") {
                braces++;
                regex += "(?:";
            } else if (token === "}" && braces > 0) {
                braces--;
                regex += ")";
            } else if (token === "," && braces > 0) regex += "|";
            else regex += token.replace(/[.+^${}()|[\]\\]/g, "\\$&");
        }

        return regex;
    }
}
