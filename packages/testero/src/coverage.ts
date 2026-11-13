import { readFileSync } from "node:fs";
import { Session } from "node:inspector/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { transform } from "esbuild";
import Transformer from "./transformer.js";

/** How often the tests called a function of a file. */
export interface FunctionCoverage {
    name: string;
    /** The line it starts on, from 1. */
    line: number;
    count: number;
}

/** The coverage of one source file. */
export interface FileCoverage {
    /** The path of the file, relative to the root. */
    file: string;
    /** How often each line with code ran, by its number from 1. */
    lines: Map<number, number>;
    /** The functions by where they start, like `3:10`. */
    functions: Map<string, FunctionCoverage>;
    /** Whether a test loaded the file, one no test loads is not covered at all. */
    loaded: boolean;
}

/** How much of something ran. */
export interface Ratio {
    covered: number;
    total: number;
}

interface Range {
    startOffset: number;
    endOffset: number;
    count: number;
}

interface ScriptCoverage {
    url: string;
    functions: { functionName: string; ranges: Range[] }[];
}

/** The session of the runs measuring coverage, and how each gets what is taken. */
interface Shared {
    session: Session | undefined;
    runs: Set<(result: ScriptCoverage[]) => void>;
}

/** A source map mapping, from a place in the generated code to one in a source, all from 0. */
export interface Segment {
    line: number;
    column: number;
    source: number;
    sourceLine: number;
    sourceColumn: number;
}

/**
 * Measures which lines and functions of the sources the tests run, with V8's
 * own coverage, mapped back to the sources by the source maps of the bundles.
 * Every test file is bundled with the sources it imports, so the counts of a
 * source are the sums of its copies.
 */
export default class Coverage {
    static readonly #digits = (() => {
        const digits = new Int8Array(128).fill(-1);
        const alphabet =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        for (let index = 0; index < alphabet.length; index++)
            digits[alphabet.charCodeAt(index)] = index;
        return digits;
    })();
    static readonly #inline =
        /\/\/# sourceMappingURL=data:application\/json;base64,([\w+/=]+)\s*$/;

    readonly #root: string;
    readonly #tracks: (file: string) => boolean;
    /** What runs within this one took, which reset the counts of this one. */
    readonly #taken: ScriptCoverage[][] = [];
    readonly #receive = (result: ScriptCoverage[]) => this.#taken.push(result);

    /** Reports the files, relative to the root, that `tracks` takes. */
    constructor(root: string, tracks: (file: string) => boolean) {
        this.#root = root;
        this.#tracks = tracks;
    }

    /**
     * The runs measuring coverage, a run within a run, like testero testing
     * itself, among them, and their session. Starting coverage clears the
     * counts of calls and taking it resets all counts, of the whole process,
     * so the runs share one session, started once, and each gets what any
     * of the others takes. Kept on globalThis, as nested runs may come from
     * different copies of this module.
     */
    static #shared(): Shared {
        const key = Symbol.for("@aljazmc/testero.coverage");
        const global = globalThis as { [key]?: Shared };
        global[key] ??= { session: undefined, runs: new Set() };
        return global[key];
    }

    /** Starts counting, before the tests load. */
    async start(): Promise<void> {
        const shared = Coverage.#shared();
        if (!shared.session) {
            const session = new Session();
            session.connect();
            await session.post("Profiler.enable");
            await session.post("Profiler.startPreciseCoverage", {
                callCount: true,
                detailed: true,
            });
            shared.session = session;
        }
        shared.runs.add(this.#receive);
    }

    /**
     * The coverage of the tracked sources of the bundles, by their paths,
     * and of the files no test loaded, sorted by path.
     */
    async collect(
        bundles: ReadonlyMap<string, string>,
        unloaded: Iterable<string> = [],
    ): Promise<FileCoverage[]> {
        const shared = Coverage.#shared();
        const session = shared.session;
        if (!session || !shared.runs.delete(this.#receive))
            throw new Error("Coverage was not started.");
        const { result } = (await session.post(
            "Profiler.takePreciseCoverage",
        )) as { result: ScriptCoverage[] };
        for (const receive of shared.runs) receive(result);
        // precise coverage stays on, as another session, like Jest's when
        // it measures testero itself, may still take it
        if (shared.runs.size === 0) {
            session.disconnect();
            shared.session = undefined;
        }

        const files = new Map<string, FileCoverage>();
        for (const taken of [...this.#taken, result])
            for (const script of taken) {
                // Node names modules by URL, a vm module, like under Jest, by path
                const path = script.url.startsWith("file:")
                    ? fileURLToPath(script.url)
                    : script.url;
                const code = bundles.get(path);
                if (code !== undefined)
                    this.#bundle(code, dirname(path), script.functions, files);
            }
        for (const file of unloaded)
            if (!files.has(file)) files.set(file, await this.#unloaded(file));

        return [...files.values()].sort((a, b) =>
            a.file < b.file ? -1 : a.file > b.file ? 1 : 0,
        );
    }

    /** Adds the counts of the sources of one bundle. */
    #bundle(
        code: string,
        directory: string,
        functions: ScriptCoverage["functions"],
        files: Map<string, FileCoverage>,
    ): void {
        const inline = Coverage.#inline.exec(code)?.[1];
        if (inline === undefined) return;
        const map = JSON.parse(Buffer.from(inline, "base64").toString()) as {
            sources: string[];
            mappings: string;
        };
        const sources = map.sources.map((source) => {
            const file = relative(this.#root, resolve(directory, source))
                .split("\\")
                .join("/");
            if (!this.#tracks(file)) return undefined;
            let coverage = files.get(file);
            if (!coverage) {
                coverage = {
                    file,
                    lines: new Map(),
                    functions: new Map(),
                    loaded: true,
                };
                files.set(file, coverage);
            }
            return coverage;
        });
        if (sources.every((source) => source === undefined)) return;

        // the count of each character is that of the innermost range around it
        const counts = new Float64Array(code.length);
        const ranges = functions
            .flatMap((fn) => fn.ranges)
            .sort(
                (a, b) =>
                    b.endOffset - b.startOffset - (a.endOffset - a.startOffset),
            );
        for (const range of ranges)
            counts.fill(range.count, range.startOffset, range.endOffset);

        const starts = [0];
        for (let index = 0; index < code.length; index++)
            if (code.charCodeAt(index) === 10) starts.push(index + 1);
        const segments = Coverage.decode(map.mappings);
        const offsets = segments.map(
            (segment) => (starts[segment.line] ?? code.length) + segment.column,
        );

        // a line ran when any of its code did, in any copy of the source
        const lines = new Map<FileCoverage, Map<number, number>>();
        segments.forEach((segment, index) => {
            const coverage = sources[segment.source];
            if (!coverage) return;
            // esbuild maps the indentation at the start of a line to where the
            // line before ended, outside of a block that did not run: only
            // the code a mapping covers counts, up to the next one
            const next = segments[index + 1];
            const end =
                next?.line === segment.line
                    ? (offsets[index + 1] as number)
                    : (starts[segment.line + 1] ?? code.length);
            let offset = offsets[index] as number;
            while (offset < end && /\s/.test(code[offset] as string)) offset++;
            if (offset >= end) return;

            const counted = lines.get(coverage) ?? new Map<number, number>();
            lines.set(coverage, counted);
            const line = segment.sourceLine + 1;
            const count = counts[offset] ?? 0;
            counted.set(line, Math.max(counted.get(line) ?? 0, count));
        });
        for (const [coverage, counted] of lines)
            for (const [line, count] of counted)
                coverage.lines.set(
                    line,
                    (coverage.lines.get(line) ?? 0) + count,
                );

        for (const { functionName, ranges } of functions) {
            const range = ranges[0];
            // the module itself, and V8's own, like <instance_members_initializer>
            if (
                !range ||
                range.startOffset === 0 ||
                functionName.startsWith("<")
            )
                continue;
            // the last mapping at or before its start, on the same line
            const index = Coverage.#before(offsets, range.startOffset) ?? -1;
            const segment = segments[index];
            const line =
                starts[Coverage.#before(starts, range.startOffset) ?? 0];
            if (!segment || (offsets[index] as number) < (line ?? 0)) continue;
            const coverage = sources[segment.source];
            if (!coverage) continue;
            const key = `${segment.sourceLine + 1}:${segment.sourceColumn + 1}`;
            const known = coverage.functions.get(key);
            if (known) known.count += range.count;
            else
                coverage.functions.set(key, {
                    name: functionName,
                    line: segment.sourceLine + 1,
                    count: range.count,
                });
        }
    }

    /** A file no test loaded: its lines with code, none of them run. */
    async #unloaded(file: string): Promise<FileCoverage> {
        const coverage: FileCoverage = {
            file,
            lines: new Map(),
            functions: new Map(),
            loaded: false,
        };
        const path = join(this.#root, file);
        const loader = Transformer.loader(path);
        if (!loader) return coverage;
        try {
            const { map } = await transform(readFileSync(path, "utf8"), {
                loader,
                sourcemap: "external",
                sourcefile: file,
            });
            const { mappings } = JSON.parse(map) as { mappings: string };
            for (const segment of Coverage.decode(mappings))
                coverage.lines.set(segment.sourceLine + 1, 0);
        } catch {
            // a file that does not compile has no lines to count
        }
        return coverage;
    }

    /** The index of the last of the sorted numbers at or before a number. */
    static #before(sorted: number[], value: number): number | undefined {
        let low = 0;
        let high = sorted.length - 1;
        let found: number | undefined;
        while (low <= high) {
            const middle = (low + high) >> 1;
            if ((sorted[middle] as number) <= value) {
                found = middle;
                low = middle + 1;
            } else high = middle - 1;
        }
        return found;
    }

    /** The mappings of a source map with a source, in order, its base64 VLQs decoded. */
    static decode(mappings: string): Segment[] {
        const segments: Segment[] = [];
        let line = 0;
        let column = 0;
        let source = 0;
        let sourceLine = 0;
        let sourceColumn = 0;
        let fields: number[] = [];
        let value = 0;
        let shift = 0;

        for (let index = 0; index <= mappings.length; index++) {
            const code = mappings.charCodeAt(index);
            // the end, a "," between segments or a ";" between lines
            if (Number.isNaN(code) || code === 44 || code === 59) {
                if (fields.length > 0) {
                    column += fields[0] as number;
                    if (fields.length >= 4) {
                        source += fields[1] as number;
                        sourceLine += fields[2] as number;
                        sourceColumn += fields[3] as number;
                        segments.push({
                            line,
                            column,
                            source,
                            sourceLine,
                            sourceColumn,
                        });
                    }
                    fields = [];
                }
                if (code === 59) {
                    line++;
                    column = 0;
                }
                continue;
            }
            const digit = Coverage.#digits[code] ?? -1;
            if (digit < 0)
                throw new Error(
                    `The source map has "${mappings[index]}" in its mappings.`,
                );
            value += (digit & 31) * 2 ** shift;
            if (digit & 32) shift += 5;
            else {
                const magnitude = Math.floor(value / 2);
                fields.push(value % 2 === 1 ? -magnitude : magnitude);
                value = 0;
                shift = 0;
            }
        }
        return segments;
    }

    /** How many of the lines with code ran. */
    static lines(coverage: FileCoverage): Ratio {
        const counts = [...coverage.lines.values()];
        return {
            covered: counts.filter((count) => count > 0).length,
            total: counts.length,
        };
    }

    /** How many of the functions ran. */
    static functions(coverage: FileCoverage): Ratio {
        const counts = [...coverage.functions.values()];
        return {
            covered: counts.filter(({ count }) => count > 0).length,
            total: counts.length,
        };
    }

    /** The sums of ratios. */
    static sum(ratios: Ratio[]): Ratio {
        return ratios.reduce(
            (sum, ratio) => ({
                covered: sum.covered + ratio.covered,
                total: sum.total + ratio.total,
            }),
            { covered: 0, total: 0 },
        );
    }

    /** A percentage like Jest's, 100 when there is nothing to run, unless nothing loaded it. */
    static percent(ratio: Ratio, loaded = true): number {
        if (ratio.total === 0) return loaded ? 100 : 0;
        return Math.floor((ratio.covered / ratio.total) * 10000) / 100;
    }

    /** The lines that did not run, in ranges like `3-5,9`. */
    static uncovered(coverage: FileCoverage): string {
        const lines = [...coverage.lines]
            .filter(([, count]) => count === 0)
            .map(([line]) => line)
            .sort((a, b) => a - b);
        const ranges: string[] = [];
        for (let index = 0; index < lines.length; ) {
            const first = lines[index] as number;
            let last = first;
            while (lines[index + 1] === last + 1)
                last = lines[++index] as number;
            ranges.push(first === last ? `${first}` : `${first}-${last}`);
            index++;
        }
        return ranges.join(",");
    }

    /** The coverage in the lcov format editors and services read. */
    static lcov(root: string, files: FileCoverage[]): string {
        return files
            .map((coverage) => {
                const records = ["TN:", `SF:${join(root, coverage.file)}`];
                const functions = [...coverage.functions.values()].sort(
                    (a, b) => a.line - b.line,
                );
                // lcov tells functions apart by their names
                const names = new Map<string, number>();
                const named = functions.map((fn) => {
                    const base = fn.name || "(anonymous)";
                    const seen = names.get(base) ?? 0;
                    names.set(base, seen + 1);
                    return {
                        ...fn,
                        name: seen === 0 ? base : `${base}_${seen}`,
                    };
                });
                for (const fn of named)
                    records.push(`FN:${fn.line},${fn.name}`);
                for (const fn of named)
                    records.push(`FNDA:${fn.count},${fn.name}`);
                const ratio = Coverage.functions(coverage);
                records.push(`FNF:${ratio.total}`, `FNH:${ratio.covered}`);
                for (const [line, count] of [...coverage.lines].sort(
                    ([a], [b]) => a - b,
                ))
                    records.push(`DA:${line},${count}`);
                const lines = Coverage.lines(coverage);
                records.push(
                    `LF:${lines.total}`,
                    `LH:${lines.covered}`,
                    "end_of_record",
                );
                return `${records.join("\n")}\n`;
            })
            .join("");
    }
}
