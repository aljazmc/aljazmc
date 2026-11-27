/** What `record.ts` writes and `biome.test.ts` reads. */
import { createHash } from "node:crypto";
import { join } from "node:path";

/** A case of `../biome.ts`: a file, its settings and its text. */
export interface Case {
    file: string;
    rules: object;
    input: string;
}

/** What Biome made of each case, by its hash. */
export interface Recording {
    biome: string;
    cases: Record<
        string,
        {
            /** What `biome format --write` wrote, or null if it did not format it. */
            formatted: string | null;
            /** Whether `biome format` found the input formatted. */
            formattedAlready: boolean;
        }
    >;
}

export const recording = join(import.meta.dirname, "biome-2.6.6.json");

/** Identifies a case by what is formatted, so it is recorded again when that changes. */
export const hash = ({ file, rules, input }: Case) =>
    createHash("sha256")
        .update(JSON.stringify([file, rules, input]))
        .digest("hex")
        .slice(0, 16);
