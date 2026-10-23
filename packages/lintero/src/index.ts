import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import Config from "@aljazmc/config";
import defaults from "./config.js";
import Lintero from "./lintero.js";
import all from "./rules/index.js";

const config = await Config.load("lintero", defaults);

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
        return JSON.parse(text);
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

/** Like Biome, domains and the module type come from the closest package.json. */
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
        found = new Lintero(
            config.rules,
            JSON.parse(readFileSync(manifest, "utf8")),
            all,
            project,
        );
        linteros.set(manifest, found);
    }
    return found;
};
const write = process.argv.includes("--write");
const unsafe = process.argv.includes("--unsafe");
const counts = { error: 0, warn: 0, info: 0 };

for (const { file, path, text } of config.sources((file) =>
    lintero.lints(file),
)) {
    const linter = linteroFor(file);
    let source = text;

    if (write) {
        const fixed = linter.fix(source, file, unsafe);
        if (fixed !== source) {
            writeFileSync(path, fixed);
            console.log(`fixed: ${file}`);
            source = fixed;
        }
    }

    for (const diagnostic of linter.lint(source, file)) {
        const { line, column, category, severity, message } = diagnostic;
        counts[severity]++;
        console.log(
            `${severity}: ${file}:${line}:${column} ${category}: ${message}`,
        );
    }
}

if (counts.error > 0) process.exitCode = 1;
console.log(
    `Found ${counts.error} errors, ${counts.warn} warnings and ${counts.info} infos.`,
);
