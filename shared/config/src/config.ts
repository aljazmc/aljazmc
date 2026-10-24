import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import Ignore from "./ignore.js";

export interface Options<Rules extends object = object> {
    ignore: string[];
    rules: Rules;
}

/** A text file found by a tool, with its path relative to the root. */
export interface Source {
    file: string;
    path: string;
    text: string;
}

export default class Config<Rules extends object = object> {
    static readonly extensions = ["ts", "js"];

    readonly root: string;
    readonly ignore: Ignore;
    readonly rules: Rules;
    /** What the config file set, before the defaults were merged in. */
    readonly custom: Partial<Options<Rules>>;

    constructor(
        options: Options<Rules>,
        root: string = process.cwd(),
        custom: Partial<Options<Rules>> = {},
    ) {
        this.root = root;
        this.ignore = new Ignore(options.ignore);
        this.rules = options.rules;
        this.custom = custom;
    }

    static async load<Rules extends object>(
        name: string,
        defaults: Options<Rules>,
        root: string = process.cwd(),
    ): Promise<Config<Rules>> {
        for (const extension of Config.extensions) {
            const file = join(root, `${name}.config.${extension}`);

            if (existsSync(file)) {
                const { default: options } = await import(
                    pathToFileURL(file).href
                );
                return new Config(
                    Config.merge(defaults, options),
                    root,
                    options,
                );
            }
        }

        return new Config(defaults, root);
    }

    /** Handles `--config`, writing the defaults to a TypeScript config file, or with `--config js` a JavaScript one. Returns whether it was given. */
    static init(
        name: string,
        defaults: Options,
        argv: string[] = process.argv.slice(2),
        root: string = process.cwd(),
    ): boolean {
        const index = argv.indexOf("--config");
        if (index === -1) return false;

        const next = argv[index + 1];
        const extension =
            next === undefined || next.startsWith("-") ? "ts" : next;
        try {
            console.log(
                `created: ${Config.export(name, defaults, extension, root)}`,
            );
        } catch (error) {
            console.error(error instanceof Error ? error.message : error);
            process.exitCode = 1;
        }
        return true;
    }

    /** Writes the defaults to `<name>.config.<extension>` in the root, unless a config file is there already. */
    static export(
        name: string,
        defaults: Options,
        extension = "ts",
        root: string = process.cwd(),
    ): string {
        if (!Config.extensions.includes(extension))
            throw new Error(
                `Unknown config file type ${extension}, use ts or js.`,
            );
        for (const existing of Config.extensions) {
            const file = `${name}.config.${existing}`;
            if (existsSync(join(root, file)))
                throw new Error(`${file} already exists.`);
        }

        const file = `${name}.config.${extension}`;
        writeFileSync(
            join(root, file),
            `export default ${Config.#literal(defaults)};\n`,
        );
        return file;
    }

    /** A value as JavaScript source, objects one property per line, short arrays on one line. */
    static #literal(value: unknown, indent = ""): string {
        const inner = `${indent}    `;
        const lines = (items: string[], open: string, close: string) =>
            items.length === 0
                ? `${open}${close}`
                : `${open}\n${items.map((item) => `${inner}${item},\n`).join("")}${indent}${close}`;

        if (Array.isArray(value)) {
            const items = value.map((item) => Config.#literal(item, inner));
            const line = `[${items.join(", ")}]`;
            return line.length <= 60 && !line.includes("\n")
                ? line
                : lines(items, "[", "]");
        }
        if (value?.constructor === Object)
            return lines(
                Object.entries(value).map(
                    ([key, item]) =>
                        `${/^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key)}: ${Config.#literal(item, inner)}`,
                ),
                "{",
                "}",
            );
        return JSON.stringify(value);
    }

    /** Deep merges plain objects, anything else in override replaces base. */
    static merge<T>(base: T, override: unknown): T {
        const plain = (value: unknown): value is Record<string, unknown> =>
            value?.constructor === Object;

        if (!plain(base) || !plain(override)) return (override ?? base) as T;

        const merged: Record<string, unknown> = { ...base };
        for (const [key, value] of Object.entries(override))
            merged[key] = Config.merge(base[key], value);

        return merged as T;
    }

    *files(directory = ""): Generator<string> {
        const entries = readdirSync(join(this.root, directory), {
            withFileTypes: true,
        });

        for (const entry of entries) {
            const path = directory ? `${directory}/${entry.name}` : entry.name;

            if (this.ignore.matches(path)) continue;

            if (entry.isDirectory()) yield* this.files(path);
            else yield path;
        }
    }

    /** Text files that are not ignored and that accepts takes, binaries are skipped. */
    *sources(
        accepts: (file: string) => boolean = () => true,
    ): Generator<Source> {
        for (const file of this.files()) {
            if (!accepts(file)) continue;

            const path = join(this.root, file);
            const text = readFileSync(path, "utf8");

            if (!text.includes("\0")) yield { file, path, text };
        }
    }
}
