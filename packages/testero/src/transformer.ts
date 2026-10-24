import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { build, type Loader, type Plugin } from "esbuild";
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
    /** Marks the resolutions the plugin asks esbuild for itself. */
    static readonly #own = Symbol("testero");

    /** Where compiled test files go, stack frames there are testero's own. */
    static readonly prefix = join(tmpdir(), "testero-build-");

    readonly #directory = mkdtempSync(Transformer.prefix);
    readonly #globals = join(this.#directory, "globals.mjs");
    #count = 0;

    constructor() {
        writeFileSync(this.#globals, Globals.source());
    }

    /** Bundles a test file, returns the URL of the module to import. */
    async compile(file: string): Promise<string> {
        const outfile = join(this.#directory, `${++this.#count}.mjs`);
        const { outputFiles } = await build({
            entryPoints: [file],
            outfile,
            write: false,
            bundle: true,
            platform: "node",
            format: "esm",
            target: `node${process.versions.node.split(".")[0]}`,
            sourcemap: "inline",
            sourcesContent: false,
            inject: [this.#globals],
            define: Object.fromEntries(
                Transformer.#meta.map((name) => [
                    `import.meta.${name}`,
                    `__testero.${name}`,
                ]),
            ),
            // CommonJS code in the bundle may require installed packages
            banner: {
                js: 'import { createRequire as __testeroRequire } from "node:module";\nconst require = __testeroRequire(import.meta.url);',
            },
            logLevel: "silent",
            plugins: [this.#plugin()],
        });
        writeFileSync(outfile, outputFiles[0]?.text ?? "");
        return pathToFileURL(outfile).href;
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
                    const contents = /\bimport\.meta\b/.test(source)
                        ? `${source}\nimport __testero from ${JSON.stringify(`testero-meta:${args.path}`)};\n`
                        : source;
                    return {
                        contents,
                        loader:
                            Transformer.#loaders[extname(args.path)] ?? "js",
                        resolveDir: dirname(args.path),
                    };
                });
            },
        };
    }

    static #installed(path: string): boolean {
        return path.split(sep).includes("node_modules");
    }
}
