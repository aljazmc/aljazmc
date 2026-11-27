import { execFile } from "node:child_process";
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { join } from "node:path";
import { biome as cases } from "../biome.ts";
import { hash, recording as path, type Recording } from "./recording.ts";

/** What Biome 2.6.6 printed, recorded by `yarn record:formatero`. */
const recorded = JSON.parse(readFileSync(path, "utf8")) as Recording;
/** The command line as it is published, built by `yarn b:formatero`. */
const main = join(import.meta.dirname, "../../bin/main.js");

/** What the command line printed and how it exited. */
interface Run {
    output: string;
    code: number;
}

/** Runs formatero on one file of a project, like a user does. */
const formatero = (cwd: string, args: string[]) =>
    new Promise<Run>((resolve) => {
        execFile(
            process.execPath,
            [main, ...args],
            { cwd, maxBuffer: 1 << 26 },
            (error, stdout) =>
                resolve({
                    output: stdout,
                    code: error ? Number(error.code ?? 1) : 0,
                }),
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

/** The check before writing, the write, what it wrote and the check after. */
const runs: { check: Run; write: Run; text: string; again: Run }[] = [];
let root: string;

beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "formatero-"));
    runs.push(
        ...(await pool(
            cases.map(({ file, rules, input }, index) => async () => {
                const directory = join(root, String(index));
                mkdirSync(directory, { recursive: true });
                writeFileSync(
                    join(directory, "formatero.config.js"),
                    `export default ${JSON.stringify({ rules })};\n`,
                );
                writeFileSync(join(directory, file), input);
                const check = await formatero(directory, [file]);
                const write = await formatero(directory, ["--write", file]);
                const text = readFileSync(join(directory, file), "utf8");
                const again = await formatero(directory, [file]);
                return { check, write, text, again };
            }),
        )),
    );
}, 600_000);

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("formatero against Biome 2.6.6", () => {
    test("every case is recorded, run yarn record:formatero after changing one", () => {
        expect(recorded.biome).toBe("2.6.6");
        expect(cases.filter((c) => !recorded.cases[hash(c)])).toEqual([]);
    });

    describe("formats what Biome formats, and checks like it", () => {
        test.each(cases.map((c, index) => ({ ...c, index })))(
            "$name in $file",
            ({ index, file, input, ...c }) => {
                const biome = recorded.cases[hash({ file, input, ...c })];
                const { check, write, text, again } = runs[index] as {
                    check: Run;
                    write: Run;
                    text: string;
                    again: Run;
                };
                // checking fails where biome format does
                expect(check.code).toBe(biome?.formattedAlready ? 0 : 1);
                if (biome?.formatted === null) {
                    // neither formats it, and the file stays as it was
                    expect(write.code).toBe(1);
                    expect(text).toBe(input);
                    return;
                }
                // --write writes what biome format --write does, once
                expect(text).toBe(biome?.formatted);
                expect(write.code).toBe(0);
                expect(write.output).toBe(
                    text === input ? "" : `formatted: ${file}\n`,
                );
                expect(again).toEqual({ output: "", code: 0 });
            },
        );
    });
});
