/** Scanners shared by the block and inline parsers. */
const TAGNAME = "[A-Za-z][A-Za-z0-9-]*";
const ATTRIBUTE =
    "(?:\\s+[a-zA-Z_:][a-zA-Z0-9:._-]*(?:\\s*=\\s*(?:[^\"'=<>`\\x00-\\x20]+|'[^']*'|\"[^\"]*\"))?)";
export const OPEN_TAG = `<${TAGNAME}${ATTRIBUTE}*\\s*/?>`;
export const CLOSE_TAG = `</${TAGNAME}\\s*[>]`;

// biome-ignore lint/complexity/noStaticOnlyClass: groups scanners
export default class Scan {
    /** Normalizes a link label for matching, like `[Foo  Bar]` and `[foo bar]`. */
    static label(label: string): string {
        return label
            .slice(1, -1)
            .trim()
            .replace(/[ \t\r\n]+/g, " ")
            .toLowerCase()
            .toUpperCase();
    }

    /** A link destination, `<...>` or without spaces and with balanced parentheses. */
    static destination(
        text: string,
        from: number,
    ): [number, string] | undefined {
        if (text[from] === "<") {
            for (let index = from + 1; index < text.length; index++) {
                const char = text[index];
                if (char === "\\") index++;
                else if (char === "\n" || char === "<") return;
                else if (char === ">")
                    return [index + 1, text.slice(from, index + 1)];
            }
            return;
        }
        let depth = 0;
        let index = from;
        while (index < text.length) {
            const char = text[index] as string;
            if (char === "\\" && /[!-/:-@[-`{-~]/.test(text[index + 1] ?? "")) {
                index += 2;
                continue;
            }
            if (char === "(") depth++;
            else if (char === ")") {
                if (depth === 0) break;
                depth--;
            } else if (char <= " " || char === "\x7f") break;
            index++;
        }
        if (depth !== 0) return;
        return [index, text.slice(from, index)];
    }

    /** The position after a link title in quotes or parentheses. */
    static title(text: string, from: number): number | undefined {
        const open = text[from];
        const close = open === "(" ? ")" : open;
        if (open !== '"' && open !== "'" && open !== "(") return;
        for (let index = from + 1; index < text.length; index++) {
            const char = text[index];
            if (char === "\\") index++;
            else if (char === close) return index + 1;
            else if (open === "(" && char === "(") return;
            else if (char === "\n" && text[index + 1] === "\n") return;
        }
    }
}
