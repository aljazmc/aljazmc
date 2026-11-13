import { writeFileSync } from "node:fs";
import { FormatError } from "./formatero.js";

/** A file to format, relative to the root and absolute, with its text. */
export interface Source {
    file: string;
    path: string;
    text: string;
}

/**
 * Formats files one after another, writing the changed ones with write, and
 * reports each file that is unformatted, formatted or failed. A file that
 * fails, even by a bug of formatero, stops no other. Returns whether every
 * file was formatted already, or written.
 */
export function formatFiles(
    sources: Iterable<Source>,
    format: (text: string, file: string) => string,
    {
        write = false,
        log = (line: string) => console.log(line),
        save = (path: string, text: string) => writeFileSync(path, text),
    }: {
        write?: boolean;
        log?: (line: string) => void;
        save?: (path: string, text: string) => void;
    } = {},
): boolean {
    let passed = true;
    for (const { file, path, text } of sources) {
        let formatted: string;
        try {
            formatted = format(text, file);
        } catch (error) {
            passed = false;
            log(
                error instanceof FormatError
                    ? `error: ${file}:${error.message}`
                    : `error: ${file}: formatero failed, please report it: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
            );
            continue;
        }
        if (formatted === text) continue;
        if (write) save(path, formatted);
        else passed = false;
        log(`${write ? "formatted" : "unformatted"}: ${file}`);
    }
    return passed;
}
