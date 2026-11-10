import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Shared } from "./rules.js";

interface Section {
    pattern: RegExp;
    properties: Map<string, string>;
}

/** Whether every `{` is closed by a later `}`, braces in `[]` count too, escaped ones do not. */
const paired = (glob: string): boolean => {
    let depth = 0;
    for (let index = 0; index < glob.length; index++) {
        const char = glob[index];
        if (char === "\\") index++;
        else if (char === "{") depth++;
        else if (char === "}" && --depth < 0) return false;
    }
    return depth === 0;
};

/**
 * Translates a section glob like Biome does: `*` and `?` stay in a path
 * segment, `**` crosses them, `[a-z]` and `[!a]` match a character, `{a,b}`
 * and `{1..3}` list alternatives, and a single unmatched brace makes every
 * brace literal. Globs without `/` match files in any folder.
 */
export function editorconfigGlob(source: string): RegExp {
    const glob = source.replace(/^\//, "");
    const braces = paired(glob);
    const literal = (char: string) =>
        char.replace(/[.+^${}()|[\]\\*?/]/g, "\\$&");
    // the regex of each `{`, `}` and `,`, decided when its alternation closes
    const parts: string[] = [];
    const open: {
        /** Where the `{` is, in the parts and in the glob. */
        index: number;
        start: number;
        comma: boolean;
        commas: number[];
    }[] = [];
    for (let index = 0; index < glob.length; index++) {
        const char = glob[index] as string;
        if (char === "\\") {
            parts.push(literal(glob[++index] ?? ""));
        } else if (char === "*") {
            if (glob[index + 1] === "*") {
                const slashBefore = index === 0 || glob[index - 1] === "/";
                while (glob[index + 1] === "*") index++;
                const slashAfter = glob[index + 1] === "/";
                if (slashBefore && slashAfter) {
                    parts.push("(?:.*/)?");
                    index++;
                } else parts.push(".*");
            } else parts.push("[^/]*");
        } else if (char === "?") {
            parts.push("[^/]");
        } else if (char === "[") {
            let end = index + 1;
            if (glob[end] === "!" || glob[end] === "^") end++;
            if (glob[end] === "]") end++;
            while (end < glob.length && glob[end] !== "]" && glob[end] !== "/")
                end += glob[end] === "\\" ? 2 : 1;
            if (glob[end] !== "]") {
                parts.push("\\[");
                continue;
            }
            let body = glob.slice(index + 1, end);
            const negated = /^[!^]/.test(body);
            if (negated) body = body.slice(1);
            const set = body.replace(
                /\\(.)|([\]\\^])/g,
                (_, escaped, special) => `\\${escaped ?? special}`,
            );
            parts.push(negated ? `[^/${set}]` : `(?!/)[${set}]`);
            index = end;
        } else if (char === "{" && braces) {
            open.push({
                index: parts.length,
                start: index,
                comma: false,
                commas: [],
            });
            parts.push("\\{");
        } else if (char === "," && open.length > 0) {
            const alternation = open.at(-1) as (typeof open)[number];
            alternation.comma = true;
            alternation.commas.push(parts.length);
            parts.push(",");
        } else if (char === "}" && open.length > 0) {
            const alternation = open.pop() as (typeof open)[number];
            const range = /^([+-]?\d+)\.\.([+-]?\d+)$/.exec(
                glob.slice(alternation.start + 1, index),
            );
            if (range) {
                const [from, to] = [Number(range[1]), Number(range[2])];
                const numbers = Array.from(
                    { length: Math.max(0, to - from + 1) },
                    (_, offset) => String(from + offset),
                );
                parts.splice(
                    alternation.index,
                    parts.length,
                    `(?:${numbers.join("|")})`,
                );
                continue;
            }
            if (alternation.comma) {
                // a comma in nested braces makes the enclosing ones an alternation too
                const parent = open.at(-1);
                if (parent) parent.comma = true;
                parts[alternation.index] = "(?:";
                for (const comma of alternation.commas) parts[comma] = "|";
                parts.push(")");
            } else parts.push("\\}");
        } else parts.push(literal(char));
    }
    const regex = parts.join("");
    // a leading `/` anchors the glob to the root, like any other `/`
    const anywhere =
        !source.includes("/") && glob !== "" && !glob.startsWith("**");
    return new RegExp(`^${anywhere ? "(?:.*/)?" : ""}${regex}$`);
}

/** The rules Biome takes from an `.editorconfig` in the root, nested ones are not read. */
export default class EditorConfig {
    readonly #sections: Section[] = [];

    constructor(text: string) {
        let section: Section | undefined;

        for (const raw of text.split(/\r\n|\r|\n/)) {
            const line = raw.trim();
            if (line === "" || line.startsWith("#") || line.startsWith(";"))
                continue;

            const header = /^\[(.*)\]$/.exec(line);
            if (header) {
                section = {
                    pattern: editorconfigGlob(header[1] ?? ""),
                    properties: new Map(),
                };
                this.#sections.push(section);
                continue;
            }

            const property = /^([^=:]+)[=:](.*)$/.exec(line);
            if (section && property)
                section.properties.set(
                    (property[1] ?? "").trim().toLowerCase(),
                    (property[2] ?? "").trim().toLowerCase(),
                );
        }
    }

    static load(root: string): EditorConfig | undefined {
        const file = join(root, ".editorconfig");
        if (existsSync(file))
            return new EditorConfig(readFileSync(file, "utf8"));
    }

    /** The rules for a file, later sections win over earlier ones. */
    rules(file: string): Partial<Shared> {
        const properties = new Map<string, string>();

        for (const section of this.#sections)
            if (section.pattern.test(file))
                for (const [key, value] of section.properties)
                    properties.set(key, value);

        const rules: Partial<Shared> = {};
        const style = properties.get("indent_style");
        if (style === "space" || style === "tab") rules.indentStyle = style;

        const size =
            properties.get("indent_size") === "tab"
                ? properties.get("tab_width")
                : properties.get("indent_size");
        if (size && /^\d+$/.test(size)) rules.indentWidth = Number(size);

        const ending = properties.get("end_of_line");
        if (ending === "lf" || ending === "crlf" || ending === "cr")
            rules.lineEnding = ending;

        const newline = properties.get("insert_final_newline");
        if (newline === "true" || newline === "false")
            rules.trailingNewline = newline === "true";

        return rules;
    }
}
