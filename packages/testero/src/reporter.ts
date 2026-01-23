import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { AssertionError } from "./expect/assertion.js";
import Format from "./expect/format.js";
import type { Result } from "./runner.js";
import Transformer from "./transformer.js";

/** The outcome of one test file. */
export interface FileResult {
    /** The path of the file, relative to the root. */
    file: string;
    results: Result[];
    /** Errors outside tests, like a file that does not compile. */
    errors: unknown[];
    duration: number;
}

interface Frame {
    file: string;
    line: number;
    column: number;
}

export interface ReporterOptions {
    verbose?: boolean;
    color?: boolean;
    write?: (text: string) => void;
}

/** Writes results like Jest's default reporter. */
export default class Reporter {
    static readonly #codes: Record<string, number> = {
        bold: 1,
        dim: 2,
        inverse: 7,
        red: 31,
        green: 32,
        yellow: 33,
        magenta: 35,
        gray: 90,
    };
    /** Stack frames from testero itself are left out of failures. */
    static readonly #own = dirname(fileURLToPath(import.meta.url));

    readonly #root: string;
    readonly #verbose: boolean;
    readonly #color: boolean;
    readonly #write: (text: string) => void;

    constructor(root: string, options: ReporterOptions = {}) {
        this.#root = root;
        this.#verbose = options.verbose ?? false;
        this.#color =
            options.color ??
            (process.stdout.isTTY === true && !process.env.NO_COLOR);
        this.#write = options.write ?? ((text) => process.stdout.write(text));
    }

    static failed(result: FileResult): boolean {
        return (
            result.errors.length > 0 ||
            result.results.some((test) => test.status === "failed")
        );
    }

    /** The results of a test file, with the failures in detail. */
    file(result: FileResult): void {
        const failed = Reporter.failed(result);
        const status = failed
            ? this.#paint(" FAIL ", "inverse", "bold", "red")
            : this.#paint(" PASS ", "inverse", "bold", "green");
        const slow =
            result.duration > 1000
                ? ` (${(result.duration / 1000).toFixed(2)} s)`
                : "";
        const lines = [`${status} ${result.file}${slow}`];

        if (this.#verbose || failed) lines.push(...this.#tree(result.results));

        for (const error of result.errors)
            lines.push(
                "",
                this.#paint("  ● Test suite failed to run", "bold", "red"),
                "",
                this.#error(error),
            );
        for (const test of result.results)
            for (const error of test.errors)
                lines.push(
                    "",
                    this.#paint(
                        `  ● ${test.test.titles.join(" › ")}`,
                        "bold",
                        "red",
                    ),
                    "",
                    this.#error(error),
                );

        this.#write(`${lines.join("\n")}\n${failed ? "\n" : ""}`);
    }

    /** Counts of test files and tests, and the time they took. */
    summary(files: FileResult[], duration: number): void {
        const results = files.flatMap((file) => file.results);
        const count = (status: string) =>
            results.filter((result) => result.status === status).length;
        const failedFiles = files.filter(Reporter.failed).length;
        const parts = (counts: [number, string, string][], total: number) =>
            [
                ...counts
                    .filter(([amount]) => amount > 0)
                    .map(([amount, label, color]) =>
                        this.#paint(`${amount} ${label}`, "bold", color),
                    ),
                `${total} total`,
            ].join(", ");

        this.#write(
            [
                "",
                `${this.#paint("Test Suites:", "bold")} ${parts(
                    [
                        [failedFiles, "failed", "red"],
                        [files.length - failedFiles, "passed", "green"],
                    ],
                    files.length,
                )}`,
                `${this.#paint("Tests:", "bold")}       ${parts(
                    [
                        [count("failed"), "failed", "red"],
                        [count("skipped"), "skipped", "yellow"],
                        [count("todo"), "todo", "magenta"],
                        [count("passed"), "passed", "green"],
                    ],
                    results.length,
                )}`,
                `${this.#paint("Time:", "bold")}        ${(duration / 1000).toFixed(3)} s`,
                "",
            ].join("\n"),
        );
    }

    /** Explains that no test files were found. */
    none(patterns: string[]): void {
        this.#write(
            `No tests found${patterns.length > 0 ? `, no files match ${patterns.map((pattern) => JSON.stringify(pattern)).join(", ")}` : ""}.\n`,
        );
    }

    /** Tests indented under their suites, with a mark for how each went. */
    #tree(results: Result[]): string[] {
        const lines: string[] = [];
        let previous: string[] = [];
        for (const { test, status, duration } of results) {
            const titles = test.suite.titles;
            let shared = 0;
            while (
                shared < titles.length &&
                titles[shared] === previous[shared]
            )
                shared++;
            for (const [depth, title] of titles.slice(shared).entries())
                lines.push(`${"  ".repeat(shared + depth + 1)}${title}`);
            previous = titles;

            const marks: Record<string, string> = {
                passed: this.#paint("✓", "green"),
                failed: this.#paint("✕", "red"),
                skipped: this.#paint("○ skipped", "yellow"),
                todo: this.#paint("✎ todo", "magenta"),
            };
            const time =
                duration >= 1
                    ? this.#paint(` (${Math.round(duration)} ms)`, "gray")
                    : "";
            lines.push(
                `${"  ".repeat(titles.length + 1)}${marks[status]} ${test.name}${status === "passed" || status === "failed" ? time : ""}`,
            );
        }
        return lines;
    }

    /** The message of an error, the code where it happened and its stack. */
    #error(error: unknown): string {
        const message =
            error instanceof AssertionError
                ? error.message
                : error instanceof Error
                  ? `${error.name}: ${error.message}`
                  : `thrown: ${Format.inline(error)}`;
        const frames =
            error instanceof Error ? this.#frames(error.stack ?? "") : [];
        const [first] = frames;

        const sections = [this.#highlight(message)];
        const code = first ? this.#code(first) : "";
        if (code) sections.push(code);
        if (frames.length > 0)
            sections.push(
                frames
                    .map((frame) =>
                        this.#paint(
                            `at ${this.#path(frame.file)}:${frame.line}:${frame.column}`,
                            "gray",
                        ),
                    )
                    .join("\n"),
            );
        return Reporter.#indent(sections.join("\n\n"), "    ");
    }

    /** Colors expected values green and received values red, like Jest. */
    #highlight(message: string): string {
        return message
            .split("\n")
            .map((line) => {
                if (/^(?:Expected|- )/.test(line))
                    return this.#paint(line, "green");
                if (/^(?:Received|\+ )/.test(line))
                    return this.#paint(line, "red");
                return line;
            })
            .join("\n");
    }

    /** Stack frames of the code under test, without Node's and testero's own. */
    #frames(stack: string): Frame[] {
        const frames: Frame[] = [];
        for (const line of stack.split("\n")) {
            const match = /^\s+at (?:.*?\()?(.+?):(\d+):(\d+)\)?$/.exec(line);
            if (!match) continue;
            let file = match[1] as string;
            if (file.startsWith("file://")) file = fileURLToPath(file);
            if (
                !isAbsolute(file) ||
                file.includes("node_modules") ||
                file.startsWith(Reporter.#own) ||
                file.startsWith(Transformer.prefix)
            )
                continue;
            frames.push({
                file,
                line: Number(match[2]),
                column: Number(match[3]),
            });
        }
        return frames;
    }

    /** The lines around a position, with a mark under it. */
    #code({ file, line, column }: Frame): string {
        if (!existsSync(file)) return "";
        const lines = readFileSync(file, "utf8").split(/\r?\n/);
        const first = Math.max(1, line - 2);
        const last = Math.min(lines.length, line + 2);
        const width = String(last).length;
        const out: string[] = [];
        for (let number = first; number <= last; number++) {
            const gutter = `${String(number).padStart(width)} |`;
            const text = lines[number - 1] ?? "";
            if (number === line) {
                out.push(
                    `${this.#paint(">", "red", "bold")} ${gutter} ${text}`,
                );
                out.push(
                    `  ${" ".repeat(width)} | ${" ".repeat(column - 1)}${this.#paint("^", "red", "bold")}`,
                );
            } else out.push(this.#paint(`  ${gutter} ${text}`, "dim"));
        }
        return out.join("\n");
    }

    #path(file: string): string {
        const path = relative(this.#root, file);
        return path.startsWith("..") ? file : path;
    }

    #paint(text: string, ...styles: string[]): string {
        if (!this.#color) return text;
        const codes = styles.map((style) => Reporter.#codes[style]).join(";");
        return `\u001b[${codes}m${text}\u001b[0m`;
    }

    static #indent(text: string, indent: string): string {
        return text
            .split("\n")
            .map((line) => (line ? indent + line : line))
            .join("\n");
    }
}
