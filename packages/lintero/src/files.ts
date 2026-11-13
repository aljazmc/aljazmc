import { writeFileSync } from "node:fs";
import type Lintero from "./lintero.js";

/** A file to lint, relative to the root and absolute, with its text. */
export interface Source {
    file: string;
    path: string;
    text: string;
}

/** How many diagnostics of each severity were found. */
export interface Counts {
    error: number;
    warn: number;
    info: number;
}

/**
 * Lints files one after another, fixing them first with write, and logs
 * each diagnostic. A file that fails, even by a bug of lintero, stops no
 * other, and counts as an error.
 */
export function lintFiles(
    sources: Iterable<Source>,
    linterFor: (file: string) => Lintero,
    {
        write = false,
        unsafe = false,
        log = (line: string) => console.log(line),
        save = (path: string, text: string) => writeFileSync(path, text),
    }: {
        write?: boolean;
        unsafe?: boolean;
        log?: (line: string) => void;
        save?: (path: string, text: string) => void;
    } = {},
): Counts {
    const counts: Counts = { error: 0, warn: 0, info: 0 };
    for (const { file, path, text } of sources) {
        try {
            const linter = linterFor(file);
            let source = text;
            if (write) {
                const fixed = linter.fix(source, file, unsafe);
                if (fixed !== source) {
                    save(path, fixed);
                    log(`fixed: ${file}`);
                    source = fixed;
                }
            }
            for (const diagnostic of linter.lint(source, file)) {
                const { line, column, category, severity, message } =
                    diagnostic;
                counts[severity]++;
                log(
                    `${severity}: ${file}:${line}:${column} ${category}: ${message}`,
                );
            }
        } catch (error) {
            counts.error++;
            log(
                `error: ${file}: lintero failed, please report it: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
            );
        }
    }
    return counts;
}
