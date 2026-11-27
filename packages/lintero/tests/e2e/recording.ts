/** What `record.ts` writes and `biome.test.ts` reads. */
import { createHash } from "node:crypto";
import { join } from "node:path";

/** A case of `../biome.ts`, or a module to organize, as a file of a project. */
export interface Case {
    rule?: string;
    file: string;
    options?: object;
    files?: Record<string, string>;
    source: string;
}

/** What Biome reported, in the lines of lintero's command line. */
export interface Recording {
    biome: string;
    /** The diagnostics of each case, by its hash. */
    cases: Record<string, string[]>;
    /** The diagnostics of each module, and the module organized, by its hash. */
    organized: Record<string, { diagnostics: string[]; fixed: string }>;
}

export const recording = join(import.meta.dirname, "biome-2.6.6.json");

/** Identifies a case by what is linted, so it is recorded again when that changes. */
export const hash = ({ rule, file, options, files, source }: Partial<Case>) =>
    createHash("sha256")
        .update(JSON.stringify([rule, file, options, files, source]))
        .digest("hex")
        .slice(0, 16);

/** Biome's names of the severities, and lintero's. */
const severities: Record<string, string> = {
    error: "error",
    warning: "warn",
    warn: "warn",
    information: "info",
    info: "info",
};

/** A diagnostic as lintero's command line prints it. */
export const line = (d: {
    severity: string;
    file: string;
    line: number;
    column: number;
    category: string;
    message: string;
}) =>
    `${severities[d.severity] ?? d.severity}: ${d.file}:${d.line}:${d.column} ${d.category}: ${d.message}`;
