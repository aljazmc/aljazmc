import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
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
});
