import { existsSync, readdirSync, readFileSync } from "node:fs";
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
