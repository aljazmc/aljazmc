import { writeFileSync } from "node:fs";
import Config from "@aljazmc/config";
import defaults from "./config.js";
import EditorConfig from "./editorconfig.js";
import Formatero, { FormatError } from "./formatero.js";

const config = await Config.load("formatero", defaults);
const editorconfig = config.rules.useEditorconfig
    ? EditorConfig.load(config.root)
    : undefined;
const formatero = new Formatero(config.rules);
const write = process.argv.includes("--write");

/** `.editorconfig` comes between the defaults and the config file, like in Biome. */
const formateroFor = (file: string): Formatero =>
    editorconfig
        ? new Formatero(
              Config.merge(
                  Config.merge(defaults.rules, editorconfig.rules(file)),
                  config.custom.rules,
              ),
          )
        : formatero;

for (const { file, path, text } of config.sources((file) =>
    formatero.formats(file),
)) {
    let formatted: string;
    try {
        formatted = formateroFor(file).format(text, file);
    } catch (error) {
        if (!(error instanceof FormatError)) throw error;
        process.exitCode = 1;
        console.log(`error: ${file}:${error.message}`);
        continue;
    }

    if (formatted === text) continue;

    if (write) writeFileSync(path, formatted);
    else process.exitCode = 1;

    console.log(`${write ? "formatted" : "unformatted"}: ${file}`);
}
