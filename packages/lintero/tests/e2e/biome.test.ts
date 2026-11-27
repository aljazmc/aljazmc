import { execFile } from "node:child_process";
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { biome as cases, organized } from "../biome.ts";
import {
    type Case,
    hash,
    recording as path,
    type Recording,
} from "./recording.ts";

/** What Biome 2.6.6 reported, recorded by `yarn record:lintero`. */
const recorded = JSON.parse(readFileSync(path, "utf8")) as Recording;
/** The command line as it is published, built by `yarn b:lintero`. */
const main = join(import.meta.dirname, "../../bin/main.js");

/** What the command line printed, a diagnostic a line, and how it exited. */
interface Run {
    lines: string[];
    fixed: boolean;
    code: number;
}

let root: string;

/** Writes a case and a config into a project of its own, returns where. */
const project = (
    index: number,
    { file, files = {}, source }: Case,
    rules: object,
) => {
    const directory = join(root, String(index));
    const all = {
        ...files,
        [file]: source,
        "lintero.config.js": `export default ${JSON.stringify({ rules })};\n`,
    };
    for (const [name, text] of Object.entries(all)) {
        mkdirSync(dirname(join(directory, name)), { recursive: true });
        writeFileSync(join(directory, name), text);
    }
    return directory;
};

/** Runs lintero on one file of a project, like a user does. */
const lintero = (cwd: string, args: string[]) =>
    new Promise<Run>((resolve) => {
        execFile(
            process.execPath,
            [main, ...args],
            { cwd, maxBuffer: 1 << 26 },
            (error, stdout) => {
                // messages may have lines of their own, a diagnostic starts with its severity
                const printed = stdout
                    .replace(/\n$/, "")
                    .split(/\n(?=(?:error|warn|info|fixed): |Found \d)/);
                resolve({
                    lines: printed
                        .filter((text) => /^(error|warn|info): /.test(text))
                        .sort(),
                    fixed: printed.some((text) => text.startsWith("fixed: ")),
                    code: error ? Number(error.code ?? 1) : 0,
                });
            },
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

/** Settings with only the rule of a case on, like the recording of Biome. */
const only = ({ rule = "", options }: Case) => {
    const [group = "", name = ""] = rule.split("/");
    return {
        preset: "none",
        [group]: { [name]: { level: "on", options } },
        assist: { enabled: false },
    };
};

const linted: Run[] = [];
const sorted: { check: Run; write: Run; text: string }[] = [];

beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "lintero-"));
    linted.push(
        ...(await pool(
            cases.map(
                (c, index) => () =>
                    lintero(project(index, c, only(c)), [c.file]),
            ),
        )),
    );
    sorted.push(
        ...(await pool(
            organized.map(({ source }, index) => async () => {
                const directory = project(
                    cases.length + index,
                    { file: "a.ts", source },
                    { preset: "none", assist: { enabled: true } },
                );
                const check = await lintero(directory, ["a.ts"]);
                const write = await lintero(directory, ["--write", "a.ts"]);
                const text = readFileSync(join(directory, "a.ts"), "utf8");
                return { check, write, text };
            }),
        )),
    );
}, 600_000);

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("lintero against Biome 2.6.6", () => {
    test("every case is recorded, run yarn record:lintero after changing one", () => {
        expect(recorded.biome).toBe("2.6.6");
        expect(cases.filter((c) => !recorded.cases[hash(c)])).toEqual([]);
        expect(
            organized.filter(
                ({ source }) => !recorded.organized[hash({ source })],
            ),
        ).toEqual([]);
    });

    describe("reports what Biome reports, and exits like it", () => {
        test.each(cases.map((c, index) => ({ ...c, index })))(
            "$rule in $file: $source",
            ({ index, ...c }) => {
                const biome = recorded.cases[hash(c)] ?? [];
                const run = linted[index] as Run;
                expect(run.lines).toEqual(biome);
                expect(run.code).toBe(
                    biome.some((line) => line.startsWith("error: ")) ? 1 : 0,
                );
            },
        );
    });

    describe("organizes imports like Biome", () => {
        test.each(organized.map((o, index) => ({ ...o, index })))(
            "$name",
            ({ index, source }) => {
                const biome = recorded.organized[hash({ source })];
                const { check, write, text } = sorted[index] as {
                    check: Run;
                    write: Run;
                    text: string;
                };
                // --write organizes it like biome check --write
                expect(text).toBe(biome?.fixed);
                expect(write.fixed).toBe(text !== source);
                expect(write).toMatchObject({ lines: [], code: 0 });
                // and the module was reported where Biome reports it
                expect(check.lines).toEqual(biome?.diagnostics);
                expect(check.code).toBe(biome?.diagnostics.length ? 1 : 0);
            },
        );
    });
});
