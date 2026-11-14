import { execFileSync } from "node:child_process";
import {
    chmodSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Config from "../../src/config.ts";

describe("config", () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "config-"));
        mkdirSync(join(root, "src/bin"), { recursive: true });
        writeFileSync(join(root, "src/a.ts"), "");
        writeFileSync(join(root, "src/bin/b.js"), "");
        writeFileSync(join(root, "c.log"), "");
    });

    afterEach(() => rmSync(root, { recursive: true }));

    test("defaults are used without a config file", async () => {
        const config = await Config.load(
            "tool",
            { ignore: ["bin"], rules: {} },
            root,
        );
        expect([...config.files()].sort()).toEqual(["c.log", "src/a.ts"]);
    });

    test("merge is deep for objects and replaces anything else", () => {
        const merged = Config.merge(
            { ignore: ["a"], rules: { a: 1, nested: { b: 2, c: 3 } } },
            { ignore: ["b"], rules: { nested: { c: 4 } } },
        );
        expect(merged).toEqual({
            ignore: ["b"],
            rules: { a: 1, nested: { b: 2, c: 4 } },
        });
    });

    test("config file rules are merged over default rules", async () => {
        writeFileSync(
            join(root, "tool.config.js"),
            "export default { rules: { b: 3 } };",
        );
        const config = await Config.load(
            "tool",
            { ignore: [], rules: { a: 1, b: 2 } },
            root,
        );
        expect(config.rules).toEqual({ a: 1, b: 3 });
    });

    test("config file overrides defaults", async () => {
        writeFileSync(
            join(root, "tool.config.js"),
            'export default { ignore: ["*.log", "tool.config.js"] };',
        );
        const config = await Config.load(
            "tool",
            { ignore: ["bin"], rules: {} },
            root,
        );
        expect([...config.files()].sort()).toEqual([
            "src/a.ts",
            "src/bin/b.js",
        ]);
    });

    test("custom holds only what the config file set", async () => {
        writeFileSync(
            join(root, "tool.config.js"),
            "export default { rules: { b: 3 } };",
        );
        const config = await Config.load(
            "tool",
            { ignore: [], rules: { a: 1, b: 2 } },
            root,
        );
        expect(config.custom).toEqual({ rules: { b: 3 } });
    });

    test("sources read accepted text files and skip binaries", async () => {
        writeFileSync(join(root, "src/a.ts"), "const a = 1;");
        writeFileSync(join(root, "src/c.ts"), "binary\0data");
        const config = await Config.load(
            "tool",
            { ignore: ["bin"], rules: {} },
            root,
        );
        const sources = [...config.sources((file) => file.endsWith(".ts"))];
        expect(sources).toEqual([
            {
                file: "src/a.ts",
                path: join(root, "src/a.ts"),
                text: "const a = 1;",
            },
        ]);
    });

    describe("--config", () => {
        const defaults = {
            ignore: [".git", "node_modules"],
            rules: {
                enabled: true,
                width: 80,
                globals: [],
                domains: {},
                "content-type": null,
                patterns: [
                    "**/__tests__/**/*.{js,jsx,ts,tsx}",
                    "**/*.{spec,test}.{js,jsx,ts,tsx}",
                ],
            },
        };
        /** Runs --config with the arguments, collecting what it prints. */
        const init = (...argv: string[]) => {
            const { log, error } = console;
            const output: unknown[] = [];
            console.log = console.error = (message) => output.push(message);
            try {
                return {
                    given: Config.init("tool", defaults, argv, root),
                    output,
                };
            } finally {
                Object.assign(console, { log, error });
            }
        };

        afterEach(() => {
            process.exitCode = undefined;
        });

        test("writes the defaults as TypeScript, which loads as the defaults", async () => {
            expect(init("--config")).toEqual({
                given: true,
                output: ["created: tool.config.ts"],
            });
            expect(readFileSync(join(root, "tool.config.ts"), "utf8")).toBe(
                [
                    "export default {",
                    '    ignore: [".git", "node_modules"],',
                    "    rules: {",
                    "        enabled: true,",
                    "        width: 80,",
                    "        globals: [],",
                    "        domains: {},",
                    '        "content-type": null,',
                    "        patterns: [",
                    '            "**/__tests__/**/*.{js,jsx,ts,tsx}",',
                    '            "**/*.{spec,test}.{js,jsx,ts,tsx}",',
                    "        ],",
                    "    },",
                    "};",
                    "",
                ].join("\n"),
            );
            const config = await Config.load("tool", defaults, root);
            expect(config.custom).toEqual(defaults);
        });

        test("writes JavaScript with --config=js too", () => {
            expect(init("--config=js").output).toEqual([
                "created: tool.config.js",
            ]);
        });

        test("writes JavaScript with js, and leaves the other options", () => {
            expect(init("--config", "js").output).toEqual([
                "created: tool.config.js",
            ]);
            rmSync(join(root, "tool.config.js"));
            expect(init("--config", "--write").output).toEqual([
                "created: tool.config.ts",
            ]);
        });

        test("does not replace a config file or write an unknown type", () => {
            writeFileSync(join(root, "tool.config.js"), "export default {};");
            expect(init("--config").output).toEqual([
                "tool.config.js already exists.",
            ]);
            expect(process.exitCode).toBe(1);
            expect(init("--config", "json").output).toEqual([
                "Unknown config file type json, use ts or js.",
            ]);
            expect(readFileSync(join(root, "tool.config.js"), "utf8")).toBe(
                "export default {};",
            );
        });

        test("does nothing without --config", () => {
            expect(init("--write")).toEqual({ given: false, output: [] });
        });
    });

    test("within matches files in the given paths, all without paths", () => {
        const config = new Config({ ignore: [], rules: {} }, root);
        const files = (paths: string[], base = root) =>
            [...config.files()].filter(config.within(paths, base)).sort();
        expect(files([])).toEqual(["c.log", "src/a.ts", "src/bin/b.js"]);
        expect(files(["src/bin"])).toEqual(["src/bin/b.js"]);
        expect(files(["c.log", "src/bin/"])).toEqual(["c.log", "src/bin/b.js"]);
        expect(files(["."])).toHaveLength(3);
        // relative to where the tool runs
        expect(files(["bin"], join(root, "src"))).toEqual(["src/bin/b.js"]);
        // src/b is not a prefix of src/bin
        expect(() => files(["src/b"])).toThrow(
            "src/b: no such file or folder.",
        );
    });

    describe("files", () => {
        /** A config of the temporary root, collecting its warnings. */
        const config = (ignore: string[] = []) => {
            const warnings: string[] = [];
            const found = new Config({ ignore, rules: {} }, root);
            found.warn = (message) => warnings.push(message);
            return { config: found, warnings };
        };

        test("symlinks are followed, each folder once, broken ones are reported", () => {
            symlinkSync("src", join(root, "linked"));
            symlinkSync("missing", join(root, "dangling"));
            symlinkSync("../..", join(root, "src/bin/loop"));
            const { config: found, warnings } = config(["c.log"]);
            expect([...found.files()].sort()).toEqual([
                "linked/a.ts",
                "linked/bin/b.js",
                "src/a.ts",
                "src/bin/b.js",
            ]);
            expect(warnings).toEqual([
                "dangling: a broken symlink (its target does not exist), left out.",
            ]);
            // an ignored broken symlink is not reported
            const ignored = config(["dangling"]);
            [...ignored.config.files()];
            expect(ignored.warnings).toEqual([]);
            expect(
                [...found.sources()].map(({ file }) => file).sort(),
            ).toContain("linked/a.ts");
        });

        test("unreadable folders and special files are left out, not fatal", () => {
            mkdirSync(join(root, "locked"));
            writeFileSync(join(root, "locked/x.ts"), "");
            chmodSync(join(root, "locked"), 0o000);
            execFileSync("mkfifo", [join(root, "pipe")]);
            try {
                const { config: found, warnings } = config(["c.log"]);
                expect(
                    [...found.sources()].map(({ file }) => file).sort(),
                ).toEqual(["src/a.ts", "src/bin/b.js"]);
                // root reads every folder, it cannot be tested as root
                if (process.getuid?.() !== 0)
                    expect(warnings).toEqual([
                        "locked: the folder cannot be read (no permission), left out.",
                    ]);
            } finally {
                chmodSync(join(root, "locked"), 0o755);
            }
        });

        test("files that are not UTF-8 are reported and skipped, a byte order mark stays", () => {
            writeFileSync(
                join(root, "latin1.txt"),
                Buffer.from([0x63, 0xe9, 0x0a]),
            );
            writeFileSync(join(root, "bom.txt"), "﻿text\n");
            writeFileSync(join(root, "binary.bin"), Buffer.from([1, 0, 2]));
            const { config: found, warnings } = config(["src", "c.log"]);
            expect(
                [...found.sources()].map(({ file, text }) => [file, text]),
            ).toEqual([["bom.txt", "﻿text\n"]]);
            expect(warnings).toEqual(["latin1.txt: not UTF-8, left out."]);
        });
    });

    test("a config file that does not export an object is a clear error", async () => {
        const defaults = { ignore: [], rules: {} };
        writeFileSync(
            join(root, "tool.config.js"),
            "export default () => ({});\n",
        );
        await expect(Config.load("tool", defaults, root)).rejects.toThrow(
            "tool.config.js must export default an object, like { ignore: [], rules: {} }, not function.",
        );
        writeFileSync(join(root, "other.config.js"), "export default [];\n");
        await expect(Config.load("other", defaults, root)).rejects.toThrow(
            "not an array.",
        );
        writeFileSync(
            join(root, "third.config.js"),
            'export default { ignore: "dist" };\n',
        );
        await expect(Config.load("third", defaults, root)).rejects.toThrow(
            "third.config.js: ignore must be a list of strings.",
        );
        // no default export keeps the defaults
        writeFileSync(join(root, "empty.config.js"), "export const a = 1;\n");
        expect((await Config.load("empty", defaults, root)).rules).toEqual({});
    });
});
