import Config from "@aljazmc/config";
import defaults from "./config.js";
import EditorConfig from "./editorconfig.js";
import { formatFiles } from "./files.js";
import Formatero from "./formatero.js";

if (Config.init("formatero", defaults)) process.exit();

const config = await Config.load("formatero", defaults);
const editorconfig = config.rules.useEditorconfig
    ? EditorConfig.load(config.root)
    : undefined;
const formatero = new Formatero(config.rules);
const write = process.argv.includes("--write");
/** The files and folders to format, all without them. */
let within: (file: string) => boolean;
try {
    within = config.within(
        process.argv.slice(2).filter((arg) => !arg.startsWith("-")),
    );
} catch (error) {
    console.log(`error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
}

/** `.editorconfig` comes between the defaults and the config file. */
const formateroFor = (file: string): Formatero =>
    editorconfig
        ? new Formatero(
              Config.merge(
                  Config.merge(defaults.rules, editorconfig.rules(file)),
                  config.custom.rules,
              ),
          )
        : formatero;

if (
    !formatFiles(
        config.sources((file) => within(file) && formatero.formats(file)),
        (text, file) => formateroFor(file).format(text, file),
        { write },
    )
)
    process.exitCode = 1;
