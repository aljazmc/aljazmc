/**
 * Compares formatero, lintero and testero with the tools people know, on
 * the code of this repository, and writes the results into the README.
 *
 *     yarn bench            # prints the results
 *     yarn bench --readme   # and writes them between the markers of README.md
 *
 * It is safe to run:
 *   - the other tools are pinned to exact versions and installed with npm
 *     into `.cache/benchmark/`, git-ignored, with `--ignore-scripts`, so no
 *     install script of theirs runs; nothing enters package.json or yarn.lock
 *   - every tool runs on a fresh copy of the sources in a temporary folder,
 *     with a home there too, all deleted afterwards; the repository itself
 *     is only read
 *   - formatters and linters run in check mode; the write, which counts the
 *     files a formatter changes, writes only into a copy of its own
 *   - it runs in the Docker container, like every script here
 */
import { execFileSync, spawnSync } from "node:child_process";
import {
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    statSync,
    writeFileSync,
} from "node:fs";
import { cpus, tmpdir } from "node:os";
import { join, relative } from "node:path";

/** The tools compared with ours, with the exact versions installed. */
export const tools: Record<string, string[]> = {
    prettier: ["prettier@3.10.1"],
    eslint: ["eslint@10.16.0", "@eslint/js@10.0.1", "typescript-eslint@8.74.0"],
    biome: ["@biomejs/biome@2.6.6"],
    jest: ["jest@30.5.2", "esbuild@0.28.2"],
    vitest: ["vitest@5.1.2"],
    formatero: ["@aljazmc/formatero"],
    lintero: ["@aljazmc/lintero"],
    testero: ["@aljazmc/testero"],
};

/** A command measured on a copy of the sources. */
export interface Run {
    tool: string;
    /** Milliseconds of each run, the first one, warming up, left out. */
    times: number[];
    /** What it found: files it changes, problems or passed tests. */
    found: number | undefined;
    /** Packages installed with it, and their size on disk in kB. */
    packages: number;
    size: number;
}

/** The middle value, the mean of the two middle ones for an even count. */
export function median(values: number[]): number {
    if (values.length === 0) return Number.NaN;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2
        ? (sorted[middle] as number)
        : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}

/** A Markdown table with its columns padded, as formatero writes it. */
export function table(head: string[], rows: string[][]): string {
    const widths = head.map((cell, column) =>
        Math.max(
            3,
            cell.length,
            ...rows.map((row) => row[column]?.length ?? 0),
        ),
    );
    const line = (cells: string[]) =>
        `| ${cells.map((cell, column) => cell.padEnd(widths[column] as number)).join(" | ")} |`;
    return [
        line(head),
        line(widths.map((width) => "-".repeat(width))),
        ...rows.map(line),
    ].join("\n");
}

/** Seconds or milliseconds, whichever reads better. */
export function duration(ms: number): string {
    return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;
}

/** A size in kB as kB or MB. */
export function size(kb: number): string {
    return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} kB`;
}

/** The rows of a comparison, ours first, each relative to ours in time. */
export function rows(runs: Run[], found: string): string[][] {
    const ours = median(runs[0]?.times ?? []);
    return runs.map((run) => {
        const time = median(run.times);
        return [
            run === runs[0] ? `**${run.tool}**` : run.tool,
            duration(time),
            run === runs[0] ? "1.0×" : `${(time / ours).toFixed(1)}×`,
            run.found === undefined ? "n/a" : `${run.found} ${found}`,
            String(run.packages),
            size(run.size),
        ];
    });
}

/** A paragraph wrapped at a width, the words kept whole. */
export function wrap(text: string, width = 80): string {
    const lines: string[] = [];
    let line = "";
    for (const word of text.split(/\s+/).filter(Boolean)) {
        if (line && line.length + 1 + word.length > width) {
            lines.push(line);
            line = word;
        } else line = line ? `${line} ${word}` : word;
    }
    if (line) lines.push(line);
    return lines.join("\n");
}

/** Replaces what is between the benchmark markers of a text. */
export function replace(text: string, section: string): string {
    const start = "<!-- benchmark:start -->";
    const end = "<!-- benchmark:end -->";
    const from = text.indexOf(start);
    const to = text.indexOf(end);
    if (from < 0 || to < from) throw new Error("No benchmark markers found.");
    return `${text.slice(0, from + start.length)}\n\n${section}\n\n${text.slice(to)}`;
}

/** Runs a command, returns how long it took and what it printed. */
function timed(command: string, args: string[], cwd: string) {
    const start = process.hrtime.bigint();
    const result = spawnSync(command, args, {
        cwd,
        encoding: "utf8",
        maxBuffer: 1 << 28,
        env: { ...process.env, CI: "1", NO_COLOR: "1", FORCE_COLOR: "0" },
    });
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    return {
        ms,
        output: `${result.stdout}\n${result.stderr}`,
        status: result.status,
    };
}

/** Counts the packages under node_modules and their size on disk in kB. */
function footprint(folder: string): { packages: number; size: number } {
    let packages = 0;
    const walk = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (!entry.isDirectory() || entry.name === ".bin") continue;
            const path = join(dir, entry.name);
            if (entry.name.startsWith("@")) walk(path);
            else if (existsSync(join(path, "package.json"))) {
                packages++;
                if (existsSync(join(path, "node_modules")))
                    walk(join(path, "node_modules"));
            }
        }
    };
    const modules = join(folder, "node_modules");
    if (existsSync(modules)) walk(modules);
    const du = execFileSync("du", ["-sk", modules], { encoding: "utf8" });
    return { packages, size: Number.parseInt(du, 10) };
}

/** Files whose contents differ between two folders. */
function changed(before: string, after: string): number {
    let count = 0;
    const walk = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const path = join(dir, entry.name);
            if (entry.isDirectory()) walk(path);
            else {
                const other = join(after, relative(before, path));
                if (
                    !existsSync(other) ||
                    !readFileSync(path).equals(readFileSync(other))
                )
                    count++;
            }
        }
    };
    walk(before);
    return count;
}

/** The TypeScript files of a folder, at any depth. */
function files(dir: string): string[] {
    return readdirSync(dir, { recursive: true, encoding: "utf8" }).filter(
        (path) => path.endsWith(".ts") && statSync(join(dir, path)).isFile(),
    );
}

if (import.meta.main) {
    const root = process.cwd();
    const cache = join(root, ".cache", "benchmark");
    const runs = Number(process.env.BENCH_RUNS ?? 5);

    // the tools, each in its own folder, so their footprints stay apart
    const install = (name: string) => {
        const folder = join(cache, name);
        const stamp = join(folder, "installed.json");
        const wanted = JSON.stringify(tools[name]);
        if (!existsSync(stamp) || readFileSync(stamp, "utf8") !== wanted) {
            console.log(`Installing ${tools[name]?.join(", ")} into ${folder}`);
            rmSync(folder, { recursive: true, force: true });
            mkdirSync(folder, { recursive: true });
            writeFileSync(join(folder, "package.json"), "{}\n");
            execFileSync(
                "npm",
                [
                    "install",
                    "--prefix",
                    folder,
                    "--ignore-scripts",
                    "--no-audit",
                    "--no-fund",
                    "--save-exact",
                    ...(tools[name] as string[]),
                ],
                { stdio: "inherit" },
            );
            writeFileSync(stamp, wanted);
        }
        return {
            bin: join(folder, "node_modules", ".bin"),
            ...footprint(folder),
        };
    };
    const installed = Object.fromEntries(
        Object.keys(tools).map((name) => [name, install(name)]),
    );
    /** The version of a package installed with a tool. */
    const version = (tool: string, name = tool) =>
        JSON.parse(
            readFileSync(
                join(cache, tool, "node_modules", name, "package.json"),
                "utf8",
            ),
        ).version as string;

    // ours as they are in this commit, built
    for (const name of ["formatero", "lintero", "testero"])
        execFileSync("yarn", [`b:${name}`], { cwd: root, stdio: "ignore" });
    const ours = (name: string) =>
        join(root, "packages", name, "bin", "main.js");

    // the sources, copied into a temporary folder with each tool's settings
    const work = mkdtempSync(join(tmpdir(), "benchmark-"));
    const source = join(work, "source");
    // a home of their own: in the container the home is the repository, and
    // Vitest, for one, writes into it
    for (const variable of [
        "HOME",
        "XDG_CACHE_HOME",
        "XDG_DATA_HOME",
        "XDG_CONFIG_HOME",
    ])
        process.env[variable] = join(work, "home", variable.toLowerCase());
    const folders = [
        ...["config", "syntax"].map((name) => `shared/${name}/src`),
        ...["formatero", "lintero", "monorepo", "testero"].map(
            (name) => `packages/${name}/src`,
        ),
    ];
    for (const folder of folders)
        cpSync(join(root, folder), join(source, folder), { recursive: true });
    const lines = folders
        .flatMap((folder) =>
            files(join(source, folder)).map((path) =>
                readFileSync(join(source, folder, path), "utf8").split("\n"),
            ),
        )
        .reduce((sum, file) => sum + file.length - 1, 0);
    const count = folders.reduce(
        (sum, folder) => sum + files(join(source, folder)).length,
        0,
    );
    const settings: Record<string, string> = {
        "formatero.config.ts": readFileSync(
            join(root, "formatero.config.ts"),
            "utf8",
        ),
        "lintero.config.ts": readFileSync(
            join(root, "lintero.config.ts"),
            "utf8",
        ),
        ".prettierrc.json": `${JSON.stringify({ tabWidth: 4, printWidth: 80, trailingComma: "all", endOfLine: "lf" })}\n`,
        "biome.json": `${JSON.stringify({
            formatter: { indentStyle: "space", indentWidth: 4, lineWidth: 80 },
            javascript: {
                formatter: {
                    quoteStyle: "double",
                    trailingCommas: "all",
                    semicolons: "always",
                },
            },
            linter: {
                enabled: true,
                rules: {
                    recommended: true,
                    suspicious: { noTemplateCurlyInString: "off" },
                },
            },
            assist: { enabled: false },
        })}\n`,
        "eslint.config.mjs": [
            `import js from ${JSON.stringify(join(cache, "eslint/node_modules/@eslint/js/src/index.js"))};`,
            `import tseslint from ${JSON.stringify(join(cache, "eslint/node_modules/typescript-eslint/dist/index.js"))};`,
            "export default [js.configs.recommended, ...tseslint.configs.recommended];",
            "",
        ].join("\n"),
    };
    for (const [file, text] of Object.entries(settings))
        writeFileSync(join(source, file), text);

    /** Measures a tool: one run to warm up, then `runs` more. */
    const measure = (
        tool: string,
        footprintOf: string,
        command: string,
        args: string[],
        cwd: string,
        find: (output: string) => number | undefined,
    ): Run => {
        let found: number | undefined;
        const times: number[] = [];
        for (let n = 0; n <= runs; n++) {
            const { ms, output } = timed(command, args, cwd);
            if (n === 0) {
                found = find(output);
                if (process.env.BENCH_DEBUG)
                    console.log(tool, output.slice(-2000));
            } else times.push(ms);
        }
        console.log(`${tool}: ${duration(median(times))}, found ${found}`);
        return { tool, times, found, ...installed[footprintOf] } as Run;
    };

    /** The files a formatter changes, writing into a copy of its own. */
    const writes = (command: string, args: string[]) => {
        const copy = join(work, `write-${Math.random().toString(36).slice(2)}`);
        cpSync(source, copy, { recursive: true });
        timed(command, args, copy);
        const result = changed(source, copy);
        rmSync(copy, { recursive: true, force: true });
        return result;
    };

    const node = process.execPath;
    const bin = (name: string, command: string) =>
        join(installed[name]?.bin ?? "", command);
    const src = folders;

    console.log(`\nFormatting ${count} files, ${lines} lines`);
    const formatting = [
        measure(
            "formatero",
            "formatero",
            node,
            [ours("formatero"), ...src],
            source,
            () => writes(node, [ours("formatero"), "--write", ...src]),
        ),
        measure(
            "Prettier",
            "prettier",
            bin("prettier", "prettier"),
            ["--check", ...src],
            source,
            () => writes(bin("prettier", "prettier"), ["--write", ...src]),
        ),
        measure(
            "Biome",
            "biome",
            bin("biome", "biome"),
            ["format", ...src],
            source,
            () => writes(bin("biome", "biome"), ["format", "--write", ...src]),
        ),
    ];

    console.log(`\nLinting ${count} files`);
    const linting = [
        measure(
            "lintero",
            "lintero",
            node,
            [ours("lintero"), ...src],
            source,
            (output) =>
                output
                    .split("\n")
                    .filter((line) => /^(error|warn|info): /.test(line)).length,
        ),
        measure(
            "ESLint",
            "eslint",
            bin("eslint", "eslint"),
            ["--format", "json", ...src],
            source,
            (output) => {
                const json = output.slice(
                    output.indexOf("["),
                    output.lastIndexOf("]") + 1,
                );
                return (
                    JSON.parse(json) as {
                        errorCount: number;
                        warningCount: number;
                    }[]
                ).reduce(
                    (sum, file) => sum + file.errorCount + file.warningCount,
                    0,
                );
            },
        ),
        measure(
            "Biome",
            "biome",
            bin("biome", "biome"),
            ["lint", "--max-diagnostics=none", ...src],
            source,
            (output) => {
                const sum = [
                    ...output.matchAll(
                        /Found (\d+) (errors?|warnings?|infos?)/g,
                    ),
                ].reduce((total, match) => total + Number(match[1]), 0);
                return sum;
            },
        ),
    ];

    // the unit tests of the shared code, with a setup each runner needs
    const suites = ["shared/config", "shared/syntax"];
    for (const suite of suites)
        cpSync(join(root, suite, "tests"), join(source, suite, "tests"), {
            recursive: true,
        });
    writeFileSync(
        join(source, "testero.config.ts"),
        'export default { rules: { testMatch: ["**/tests/**/*.test.ts"] } };\n',
    );
    writeFileSync(
        join(source, "esbuild-jest.cjs"),
        [
            `const { transformSync } = require(${JSON.stringify(join(cache, "jest/node_modules/esbuild"))});`,
            "module.exports = {",
            "    process(code, file, options) {",
            "        const { code: js } = transformSync(code, {",
            '            loader: "ts",',
            '            format: options.supportsStaticESM ? "esm" : "cjs",',
            "            sourcefile: file,",
            "        });",
            "        return { code: js };",
            "    },",
            "};",
            "",
        ].join("\n"),
    );
    writeFileSync(
        join(source, "jest.config.json"),
        `${JSON.stringify({
            testEnvironment: "node",
            testMatch: ["**/tests/**/*.test.ts"],
            moduleFileExtensions: ["ts", "js", "json"],
            extensionsToTreatAsEsm: [".ts"],
            // the sources import their .ts files as .js, as tsc wants
            moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
            transform: { "\\.ts$": "<rootDir>/esbuild-jest.cjs" },
        })}\n`,
    );
    writeFileSync(
        join(source, "vitest.config.mjs"),
        'export default { test: { globals: true, include: ["**/tests/**/*.test.ts"] } };\n',
    );
    const testCount = suites.reduce(
        (sum, suite) => sum + files(join(source, suite, "tests")).length,
        0,
    );

    console.log(`\nTesting ${testCount} test files`);
    const testing = [
        measure(
            "testero",
            "testero",
            node,
            [ours("testero"), ...suites],
            source,
            (output) =>
                Number(/Tests:\s+(\d+) passed/.exec(output)?.[1] ?? Number.NaN),
        ),
        // Jest needs this flag for the import() of config files
        measure(
            "Jest",
            "jest",
            node,
            [
                "--experimental-vm-modules",
                join(cache, "jest/node_modules/jest/bin/jest.js"),
                "--ci",
                ...suites,
            ],
            source,
            (output) =>
                Number(/Tests:\s+(\d+) passed/.exec(output)?.[1] ?? Number.NaN),
        ),
        measure(
            "Vitest",
            "vitest",
            bin("vitest", "vitest"),
            ["run", ...suites],
            source,
            (output) =>
                Number(/Tests\s+(\d+) passed/.exec(output)?.[1] ?? Number.NaN),
        ),
    ];

    rmSync(work, { recursive: true, force: true });

    const head = (found: string) => [
        "Tool",
        "Time",
        "Relative",
        found,
        "Packages",
        "Installed",
    ];
    const cpu = cpus()[0]?.model.replace(/\s+/g, " ").trim() ?? "unknown";
    const date = new Date().toISOString().slice(0, 10);
    const biome = version("biome", "@biomejs/biome");
    const section = [
        wrap(
            `Measured on ${date} with \`yarn bench\`, on the ${count} TypeScript ` +
                `files of the packages' \`src\` folders, ` +
                `${lines.toLocaleString("en")} lines, and the ${testCount} test ` +
                `files of \`shared/\`, in Docker on ${cpus().length} cores of an ` +
                `${cpu}, with Node.js ${process.version}. A time is the median ` +
                `of ${runs} runs after one to warm up. Packages and Installed ` +
                "are what `npm install` of a tool brings in; Biome is a " +
                "native binary, the others run on Node.js.",
        ),
        "",
        wrap(
            `**Formatting**, checking every file with the same settings: ` +
                `Prettier ${version("prettier")} and Biome ${biome}. Changes ` +
                "are the files a write would change; formatero formats " +
                "this repository.",
        ),
        "",
        table(head("Changes"), rows(formatting, "files")),
        "",
        wrap(
            "**Linting** with each tool's recommended rules: ESLint " +
                `${version("eslint")} with typescript-eslint ` +
                `${version("eslint", "typescript-eslint")}, and Biome ${biome}. ` +
                "The rules differ, and so do the problems they find.",
        ),
        "",
        table(head("Problems"), rows(linting, "problems")),
        "",
        wrap(
            "**Testing**, the same tests unchanged: Jest " +
                `${version("jest")}, with esbuild for TypeScript, and Vitest ` +
                `${version("vitest")}.`,
        ),
        "",
        table(head("Passed"), rows(testing, "tests")),
    ].join("\n");
    console.log(`\n${section}`);
    if (process.argv.includes("--readme")) {
        const readme = join(root, "README.md");
        writeFileSync(readme, replace(readFileSync(readme, "utf8"), section));
        console.log("\nREADME.md updated.");
    }
}
