import {
    type Dirent,
    existsSync,
    readdirSync,
    readFileSync,
    realpathSync,
    statSync,
    writeFileSync,
} from "node:fs";
import { join, relative, resolve, sep } from "node:path";
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
    /**
     * Reports files and folders that are left out, like a broken symlink, an
     * unreadable folder or a file that is not UTF-8, as a warning by default.
     */
    warn: (message: string) => void = (message) =>
        console.log(`warn: ${message}`);

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
                Config.#check(`${name}.config.${extension}`, options);
                return new Config(
                    Config.merge(defaults, options),
                    root,
                    options,
                );
            }
        }

        return new Config(defaults, root);
    }

    /** Fails clearly on a config file that does not export the shape of the defaults. */
    static #check(file: string, options: unknown): void {
        if (options === undefined) return;
        if (options?.constructor !== Object)
            throw new Error(
                `${file} must export default an object, like { ignore: [], rules: {} }, not ${Array.isArray(options) ? "an array" : typeof options}.`,
            );
        const { ignore } = options as { ignore?: unknown };
        if (
            ignore !== undefined &&
            !(
                Array.isArray(ignore) &&
                ignore.every((item) => typeof item === "string")
            )
        )
            throw new Error(`${file}: ignore must be a list of strings.`);
    }

    /** Handles `--config`, writing the defaults to a TypeScript config file, or with `--config js` a JavaScript one. Returns whether it was given. */
    static init(
        name: string,
        defaults: Options,
        argv: string[] = process.argv.slice(2),
        root: string = process.cwd(),
    ): boolean {
        const index = argv.findIndex(
            (arg) => arg === "--config" || arg.startsWith("--config="),
        );
        if (index === -1) return false;

        // `--config js` or `--config=js`
        const [, inline] = (argv[index] as string).split(/=(.*)/s);
        const next = inline ?? argv[index + 1];
        const extension =
            next === undefined || next === "" || next.startsWith("-")
                ? "ts"
                : next;
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

    /**
     * Whether a file, relative to the root, is one of some paths or in one
     * of them, like the paths a tool is given on its command line, relative
     * to `base`. Without paths, every file is. A path that does not exist is
     * an error.
     */
    within(
        paths: readonly string[],
        base: string = process.cwd(),
    ): (file: string) => boolean {
        if (paths.length === 0) return () => true;
        const relatives = paths.map((path) => {
            const absolute = resolve(base, path);
            if (!existsSync(absolute))
                throw new Error(`${path}: no such file or folder.`);
            return relative(this.root, absolute).split(sep).join("/");
        });
        return (file) =>
            relatives.some(
                (path) =>
                    path === "" || file === path || file.startsWith(`${path}/`),
            );
    }

    /**
     * The files that are not ignored, relative to the root. Symlinks are
     * followed, a folder by every path to it, but not into a folder it is in,
     * which would never end; broken symlinks and unreadable folders are
     * reported and left out, like pipes and other special files.
     */
    *files(directory = ""): Generator<string> {
        yield* this.#walk(directory, new Set());
    }

    *#walk(directory: string, ancestors: Set<string>): Generator<string> {
        const absolute = join(this.root, directory);
        let entries: Dirent[];
        let real: string;
        try {
            real = realpathSync(absolute);
            // a symlink to a folder this one is in loops
            if (ancestors.has(real)) return;
            entries = readdirSync(absolute, { withFileTypes: true });
        } catch (error) {
            this.warn(
                `${directory || "."}: the folder cannot be read (${Config.#reason(error)}), left out.`,
            );
            return;
        }

        ancestors.add(real);
        for (const entry of entries) {
            const path = directory ? `${directory}/${entry.name}` : entry.name;
            let kind: "directory" | "file" | "other" = entry.isDirectory()
                ? "directory"
                : entry.isFile()
                  ? "file"
                  : "other";
            if (entry.isSymbolicLink())
                try {
                    const target = statSync(join(this.root, path));
                    kind = target.isDirectory()
                        ? "directory"
                        : target.isFile()
                          ? "file"
                          : "other";
                } catch (error) {
                    if (!this.ignore.matches(path))
                        this.warn(
                            `${path}: a broken symlink (${Config.#reason(error)}), left out.`,
                        );
                    continue;
                }

            if (this.ignore.matches(path, kind === "directory")) continue;

            if (kind === "directory") yield* this.#walk(path, ancestors);
            else if (kind === "file") yield path;
        }
        ancestors.delete(real);
    }

    /**
     * Text files that are not ignored and that accepts takes. Binaries, with
     * a NUL byte, are skipped; files that are not UTF-8 are reported and
     * skipped, as writing them back as UTF-8 would change their text.
     */
    *sources(
        accepts: (file: string) => boolean = () => true,
    ): Generator<Source> {
        const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
        for (const file of this.files()) {
            if (!accepts(file)) continue;

            const path = join(this.root, file);
            let bytes: Buffer;
            try {
                bytes = readFileSync(path);
            } catch (error) {
                this.warn(
                    `${file}: the file cannot be read (${Config.#reason(error)}), left out.`,
                );
                continue;
            }
            if (bytes.includes(0)) continue;
            let text: string;
            try {
                text = utf8.decode(bytes);
            } catch {
                this.warn(`${file}: not UTF-8, left out.`);
                continue;
            }
            yield { file, path, text };
        }
    }

    /** Why a file system call failed, in words. */
    static #reason(error: unknown): string {
        const code = (error as { code?: string } | null)?.code;
        switch (code) {
            case "ENOENT":
                return "its target does not exist";
            case "EACCES":
            case "EPERM":
                return "no permission";
            case "ELOOP":
                return "a loop of symlinks";
            default:
                return error instanceof Error ? error.message : String(error);
        }
    }
}
