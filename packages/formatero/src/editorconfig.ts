import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Pattern } from "@aljazmc/config";
import type { Shared } from "./rules.js";

interface Section {
    pattern: Pattern;
    properties: Map<string, string>;
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
                    pattern: new Pattern(header[1] ?? ""),
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
            if (section.pattern.matches(file))
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
