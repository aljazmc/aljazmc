import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import Config from "@aljazmc/config";
import defaults from "./config.js";
import { lintFiles } from "./files.js";
import Lintero from "./lintero.js";
import all from "./rules/index.js";

if (Config.init("lintero", defaults)) process.exit();

const config = await Config.load("lintero", defaults);
/** Problems with the files of the project, reported with the diagnostics. */
const problems: string[] = [];

/** Reads a JSON file of the project, also with comments and trailing commas like `turbo.jsonc`. */
const readJson = (...names: string[]): unknown => {
    for (const name of names) {
        const path = join(config.root, name);
        if (!existsSync(path)) continue;
        const text = readFileSync(path, "utf8")
            .replace(
                /("(?:[^"\\]|\\.)*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g,
                (_, string) => string ?? "",
            )
            .replace(/,(\s*[}\]])/g, "$1");
        try {
            return JSON.parse(text);
        } catch (error) {
            problems.push(
                `error: ${name}: ${error instanceof Error ? error.message : String(error)}, linted without it.`,
            );
            return undefined;
        }
    }
};
const project = {
    turbo: readJson("turbo.json", "turbo.jsonc"),
    read: (file: string) => {
        const path = join(config.root, file);
        return existsSync(path) ? readFileSync(path, "utf8") : undefined;
    },
};
const linteros = new Map<string, Lintero>();
const lintero = new Lintero(config.rules, {}, all, project);

/**
 * Domains and the module type come from the closest package.json, one that
 * is not valid JSON, like a test fixture, gives the defaults.
 */
const linteroFor = (file: string): Lintero => {
    let directory = dirname(join(config.root, file));
    while (!existsSync(join(directory, "package.json"))) {
        const parent = dirname(directory);
        if (parent === directory || !parent.startsWith(config.root))
            return lintero;
        directory = parent;
    }
    const manifest = join(directory, "package.json");
    let found = linteros.get(manifest);
    if (!found) {
        try {
            found = new Lintero(
                config.rules,
                JSON.parse(readFileSync(manifest, "utf8")),
                all,
                project,
            );
        } catch (error) {
            console.log(
                `warn: ${relative(config.root, manifest)}: ${error instanceof Error ? error.message : String(error)}, its files are linted without its domains.`,
            );
            found = lintero;
        }
        linteros.set(manifest, found);
    }
    return found;
};

/** The files and folders to lint, all without them. */
let within: (file: string) => boolean;
try {
    within = config.within(
        process.argv.slice(2).filter((arg) => !arg.startsWith("-")),
    );
} catch (error) {
    console.log(`error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
}

for (const problem of problems) console.log(problem);
const counts = lintFiles(
    config.sources((file) => within(file) && lintero.lints(file)),
    linteroFor,
    {
        write: process.argv.includes("--write"),
        unsafe: process.argv.includes("--unsafe"),
    },
);
counts.error += problems.length;

if (counts.error > 0) process.exitCode = 1;
console.log(
    `Found ${counts.error} errors, ${counts.warn} warnings and ${counts.info} infos.`,
);
