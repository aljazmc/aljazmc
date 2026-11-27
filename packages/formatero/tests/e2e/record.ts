/**
 * Records what Biome 2.6.6 itself prints for the cases of `../biome.ts`,
 * into `biome-2.6.6.json`, for `biome.test.ts` to compare the command line
 * of formatero with. Biome is installed into `.cache/`, never into the
 * project, and run for each case in a project of its own, with the settings
 * of the case. Run it with `yarn record:formatero` after adding or changing
 * a case; Biome is pinned, so the recording of a case never goes stale.
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
import { join } from "node:path";
import { biome as cases } from "../biome.ts";
import { type Case, hash, type Recording, recording } from "./recording.ts";

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

/**
 * Biome's settings for formatero's: those of all languages are the
 * formatter's, those of a language its formatter's.
 */
const settings = (rules: Record<string, unknown>) => {
    const languages = ["javascript", "json", "css", "html", "markdown", "yaml"];
    const formatter = Object.fromEntries(
        Object.entries(rules).filter(([key]) => !languages.includes(key)),
    );
    return {
        formatter: { enabled: true, ...formatter },
        ...Object.fromEntries(
            languages.map((language) => [
                language,
                { formatter: rules[language] ?? {} },
            ]),
        ),
        linter: { enabled: false },
        assist: { enabled: false },
    };
};

/** Runs Biome in a folder, resolves with its exit code. */
const biome = (cwd: string, args: string[]) =>
    new Promise<number>((resolve) => {
        execFile(bin, args, { cwd }, (error) =>
            resolve(error ? Number(error.code ?? 1) : 0),
        );
    });

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

const temporary = mkdtempSync(join(tmpdir(), "biome-"));

try {
    const formatted = await pool(
        cases.map((c: Case, index) => async () => {
            const directory = join(temporary, String(index));
            mkdirSync(directory, { recursive: true });
            writeFileSync(
                join(directory, "biome.json"),
                JSON.stringify(settings(c.rules as Record<string, unknown>)),
            );
            const path = join(directory, c.file);
            writeFileSync(path, c.input);
            const check = await biome(directory, ["format", c.file]);
            const write = await biome(directory, ["format", "--write", c.file]);
            const result: Recording["cases"][string] = {
                formatted: write === 0 ? readFileSync(path, "utf8") : null,
                formattedAlready: check === 0,
            };
            return [hash(c), result] as const;
        }),
    );
    const result: Recording = {
        biome: version,
        cases: Object.fromEntries(formatted),
    };
    writeFileSync(recording, `${JSON.stringify(result, null, 4)}\n`);
    console.log(`Recorded ${formatted.length} cases of Biome ${version}.`);
} finally {
    rmSync(temporary, { recursive: true, force: true });
}
