/**
 * Records what Biome 2.6.6 itself reports for the cases of `../biome.ts`,
 * into `biome-2.6.6.json`, for `biome.test.ts` to compare the command line
 * of lintero with. Biome is installed into `.cache/`, never into the
 * project, and run once for each case, in a project of its own with only the
 * rule of the case on. Run it with `yarn record:lintero` after adding or
 * changing a case; Biome is pinned, so the recording of a case never goes
 * stale.
 */
import { execFile, execFileSync } from "node:child_process";
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { biome as cases, organized } from "../biome.ts";
import { type Case, hash, line, recording } from "./recording.ts";

const version = "2.6.6";
const root = join(import.meta.dirname, "../../../..");
const install = join(root, ".cache", `biome-${version}`);
const bin = join(install, "node_modules", ".bin", "biome");

if (!existsSync(bin)) {
    console.log(`Installing Biome ${version} into ${install}`);
    mkdirSync(install, { recursive: true });
    execFileSync(
        "npm",
        [
            "install",
            "--prefix",
            install,
            "--no-audit",
            "--no-fund",
            "--no-save",
            `@biomejs/biome@${version}`,
        ],
        { stdio: "inherit" },
    );
}
const installed = execFileSync(bin, ["--version"], { encoding: "utf8" });
if (!installed.includes(version))
    throw new Error(`Expected Biome ${version}, found ${installed.trim()}`);

/** Biome's settings, with only the rule of a case on, like the unit tests. */
const settings = (rule?: string, options?: object) => {
    const [group = "", name = ""] = rule?.split("/") ?? [];
    return {
        linter: rule
            ? {
                  rules: {
                      preset: "none",
                      [group]: {
                          [name]: options ? { level: "on", options } : "on",
                      },
                  },
              }
            : { enabled: false },
        assist: rule
            ? { enabled: false }
            : {
                  enabled: true,
                  actions: { source: { organizeImports: "on" } },
              },
        formatter: { enabled: false },
        html: { linter: { enabled: true } },
    };
};

interface Report {
    diagnostics: {
        category: string;
        severity: string;
        message: string;
        location?: {
            path?: string;
            start?: { line: number; column: number };
        };
    }[];
}

/** Runs Biome in a folder, returns its diagnostics of one file as lines. */
const biome = (cwd: string, file: string, args: string[]) =>
    new Promise<string[]>((resolve, reject) => {
        execFile(
            bin,
            [...args, "--reporter=json", "--max-diagnostics=none", "."],
            { cwd, maxBuffer: 1 << 26 },
            (_error, stdout, stderr) => {
                const json = stdout
                    .split("\n")
                    .find((text) => text.startsWith("{"));
                if (!json)
                    return reject(
                        new Error(`Biome failed in ${cwd}: ${stderr}`),
                    );
                const { diagnostics } = JSON.parse(json) as Report;
                resolve(
                    diagnostics
                        .filter(({ location }) => location?.path === file)
                        .map(({ category, severity, message, location }) =>
                            line({
                                severity,
                                file,
                                line: location?.start?.line ?? 0,
                                column: location?.start?.column ?? 0,
                                category,
                                message,
                            }),
                        )
                        .sort(),
                );
            },
        );
    });

const temporary = mkdtempSync(join(tmpdir(), "biome-"));

/** Writes a case into a project of its own, returns where. */
const project = (index: number, { file, files = {}, source }: Case) => {
    const directory = join(temporary, String(index));
    for (const [path, text] of Object.entries({ ...files, [file]: source })) {
        mkdirSync(dirname(join(directory, path)), { recursive: true });
        writeFileSync(join(directory, path), text);
    }
    return directory;
};

/** Settings in the project, or outside for a case of the root config itself. */
const configure = (index: number, directory: string, config: object) => {
    const outside = existsSync(join(directory, "biome.json"))
        ? join(temporary, `${index}.config`)
        : directory;
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(outside, "biome.json"), JSON.stringify(config));
    // project rules, like noPrivateImports, need the settings at the root
    return outside === directory ? [] : [`--config-path=${outside}`];
};

/** Runs jobs a few at a time. */
const pool = async <T>(jobs: (() => Promise<T>)[]): Promise<T[]> => {
    const results: T[] = [];
    let next = 0;
    const worker = async () => {
        while (next < jobs.length) {
            const index = next++;
            results[index] = await (jobs[index] as () => Promise<T>)();
        }
    };
    await Promise.all(Array.from({ length: availableParallelism() }, worker));
    return results;
};

try {
    const linted = await pool(
        cases.map((c, index) => async () => {
            const directory = project(index, c);
            const args = configure(
                index,
                directory,
                settings(c.rule, c.options),
            );
            return [hash(c), await biome(directory, c.file, ["lint", ...args])];
        }),
    );
    const sorted = await pool(
        organized.map(({ source }, index) => async () => {
            const at = cases.length + index;
            const directory = project(at, { file: "a.ts", source });
            const args = configure(at, directory, settings());
            const diagnostics = await biome(directory, "a.ts", [
                "check",
                ...args,
            ]);
            await biome(directory, "a.ts", ["check", "--write", ...args]);
            const fixed = readFileSync(join(directory, "a.ts"), "utf8");
            return [hash({ source }), { diagnostics, fixed }];
        }),
    );
    writeFileSync(
        recording,
        `${JSON.stringify(
            {
                biome: version,
                cases: Object.fromEntries(linted),
                organized: Object.fromEntries(sorted),
            },
            null,
            4,
        )}\n`,
    );
    console.log(
        `Recorded ${linted.length} cases and ${sorted.length} organized modules of Biome ${version}.`,
    );
} finally {
    rmSync(temporary, { recursive: true, force: true });
}
