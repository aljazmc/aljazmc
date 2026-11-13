import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { type BuildOptions, build, type Loader, type Plugin } from "esbuild";
import Globals from "./globals.js";

/**
 * Compiles a test file and the local files it imports with esbuild, into one
 * module Node can import. Installed packages stay external, and the globals
 * like `describe` and `expect` are injected where the file uses them.
 */
export default class Transformer {
    /** Packages test files import the globals from, like with Jest. */
    static readonly modules = ["@jest/globals", "@aljazmc/testero"];

    static readonly #loaders: Record<string, Loader> = {
        ".js": "js",
        ".cjs": "js",
        ".mjs": "js",
        ".jsx": "jsx",
        ".ts": "ts",
        ".cts": "ts",
        ".mts": "ts",
        ".tsx": "tsx",
    };
    /** The import.meta properties that describe the source file. */
    static readonly #meta = ["url", "filename", "dirname"];
    /** CommonJS globals the ES module bundle lacks, mapped to the same descriptions. */
    static readonly #commonjs: Record<string, string> = {
        __dirname: "dirname",
        __filename: "filename",
    };
    /** Sources that refer to the location of their own file. */
    static readonly #located = /\bimport\.meta\b|\b__dirname\b|\b__filename\b/;
    /** Marks the resolutions the plugin asks esbuild for itself. */
    static readonly #own = Symbol("testero");

    /** Where compiled test files go, stack frames there are testero's own. */
    static readonly prefix = join(tmpdir(), "testero-build-");

    readonly #directory = mkdtempSync(Transformer.prefix);
    readonly #globals = join(this.#directory, "globals.mjs");
    #count = 0;
    /** The code of each compiled module by its path, with an inline source map, for coverage. */
    readonly bundles = new Map<string, string>();
    readonly #keep: boolean;

    /** Keeps the code of the compiled modules in `bundles` when told. */
    constructor(keep = false) {
        this.#keep = keep;
        writeFileSync(this.#globals, Globals.source());
    }

    /** Bundles a test file, returns the URL of the module to import. */
    async compile(file: string): Promise<string> {
        const outfile = join(this.#directory, `${++this.#count}.mjs`);
        const { outputFiles } = await build({
            ...this.#options(file),
            outfile,
            sourcemap: "inline",
            sourcesContent: false,
            // for coverage, code no test imports counts too
            treeShaking: !this.#keep,
        });
        const code = outputFiles[0]?.text ?? "";
        writeFileSync(outfile, code);
        if (this.#keep) this.bundles.set(outfile, code);
        return pathToFileURL(outfile).href;
    }

    /** The absolute paths of the local files a test file is bundled from, itself included. */
    async inputs(file: string): Promise<string[]> {
        const { metafile } = await build({
            ...this.#options(file),
            metafile: true,
        });
        // other namespaces, like testero-meta, are prefixed with theirs
        return Object.keys(metafile.inputs)
            .filter((input) => !/^[\w-]+:/.test(input))
            .map((input) => resolve(input))
            .filter((input) => input !== this.#globals);
    }

    /** What compiling and listing the inputs share. */
    #options(file: string): BuildOptions & { write: false } {
        return {
            entryPoints: [file],
            write: false,
            bundle: true,
            platform: "node",
            format: "esm",
            target: `node${process.versions.node.split(".")[0]}`,
            inject: [this.#globals],
            // defines replace only unbound names, so a file's own `__dirname` stays
            define: Object.fromEntries([
                ...Transformer.#meta.map((name) => [
                    `import.meta.${name}`,
                    `__testero.${name}`,
                ]),
                ...Object.entries(Transformer.#commonjs).map(
                    ([name, property]) => [name, `__testero.${property}`],
                ),
            ]),
            // CommonJS code in the bundle may require installed packages
            banner: {
                js: 'import { createRequire as __testeroRequire } from "node:module";\nconst require = __testeroRequire(import.meta.url);',
            },
            logLevel: "silent",
            plugins: [this.#plugin()],
        };
    }

    /** The esbuild loader of a source file, undefined for files it does not compile. */
    static loader(path: string): Loader | undefined {
        return Transformer.#loaders[extname(path)];
    }

    /** Removes the compiled files. */
    dispose(): void {
        rmSync(this.#directory, { recursive: true, force: true });
    }

    #plugin(): Plugin {
        return {
            name: "testero",
            setup: (build) => {
                // the bundle lives elsewhere, so import.meta describes each source file:
                // the defines turn it into `__testero`, which esbuild binds to the
                // hoisted import after the last line, keeping lines and columns,
                // while import.meta in strings and comments stays as it is;
                // resolved ahead of the bare specifiers, it is one too
                build.onResolve({ filter: /^testero-meta:/ }, (args) => ({
                    path: args.path.slice("testero-meta:".length),
                    namespace: "testero-meta",
                }));
                build.onLoad(
                    { filter: /.*/, namespace: "testero-meta" },
                    (args) => ({
                        contents: `export default ${JSON.stringify({
                            url: pathToFileURL(args.path).href,
                            filename: args.path,
                            dirname: dirname(args.path),
                        })};`,
                        loader: "js",
                    }),
                );

                // bare specifiers: the globals, installed packages and workspace sources
                build.onResolve({ filter: /^[^./]/ }, async (args) => {
                    if (args.pluginData === Transformer.#own) return undefined;
                    if (Transformer.modules.includes(args.path))
                        return { path: this.#globals };

                    const resolved = await build.resolve(args.path, {
                        kind: args.kind,
                        resolveDir: args.resolveDir,
                        pluginData: Transformer.#own,
                    });
                    if (resolved.errors.length > 0)
                        return { errors: resolved.errors };
                    if (resolved.external)
                        return { path: args.path, external: true };
                    if (!Transformer.#installed(resolved.path))
                        return { path: resolved.path };
                    return {
                        path:
                            args.kind === "require-call"
                                ? resolved.path
                                : pathToFileURL(resolved.path).href,
                        external: true,
                    };
                });

                build.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, (args) => {
                    if (Transformer.#installed(args.path)) return undefined;
                    const source = readFileSync(args.path, "utf8");
                    return {
                        contents: Transformer.#locate(source, args.path),
                        loader:
                            Transformer.#loaders[extname(args.path)] ?? "js",
                        resolveDir: dirname(args.path),
                    };
                });
            },
        };
    }

    /**
     * A source with `__testero` describing its file, when it refers to it.
     * Modules import it after their last line, as imports are hoisted.
     * CommonJS files, without import or export statements, require it at the
     * start of their first line instead, as an import would make them modules
     * and their `module.exports` would be lost.
     */
    static #locate(source: string, path: string): string {
        if (!Transformer.#located.test(source)) return source;
        const meta = JSON.stringify(`testero-meta:${path}`);
        // ES modules by their extension, or by import statements, not
        // `import(` nor `import.meta`, or exports
        if (
            /\.m[jt]s$/.test(path) ||
            /^\s*(?:import\s*[\w{*"']|export\b)/m.test(source)
        )
            return `${source}\nimport __testero from ${meta};\n`;
        // after a shebang, which must stay first
        const start = source.startsWith("#!") ? source.indexOf("\n") + 1 : 0;
        if (source.startsWith("#!") && start === 0) return source;
        return `${source.slice(0, start)}var __testero = require(${meta}).default;${source.slice(start)}`;
    }

    static #installed(path: string): boolean {
        return path.split(sep).includes("node_modules");
    }
}
