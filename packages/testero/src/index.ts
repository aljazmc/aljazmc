import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { join, relative, sep } from "node:path";
import Config, { Pattern } from "@aljazmc/config";
import Arguments from "./arguments.js";
import defaults from "./config.js";
import Testero from "./testero.js";
import Transformer from "./transformer.js";
import Watcher, { Dependencies } from "./watcher.js";

try {
    if (Config.init("testero", defaults)) process.exit();

    const args = new Arguments(process.argv.slice(2));

    if (args.help) process.stdout.write(Arguments.usage);
    else {
        const config = await Config.load("testero", defaults);
        const options = args.options(config.rules);
        const testero = new Testero(config, options);

        if (args.listTests)
            for (const file of testero.files()) console.log(file);
        else if (args.watch) {
            // every run is a process of its own, which starts with no modules
            // loaded and leaves nothing behind
            const entry = process.argv[1] as string;
            const exactly = (file: string) =>
                `^${file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`;
            const transformer = new Transformer();
            const dependencies = new Dependencies(async (file) =>
                (await transformer.inputs(join(config.root, file))).map(
                    (input) =>
                        relative(config.root, input).split(sep).join("/"),
                ),
            );
            const coverage = new Pattern(`/${options.coverageDirectory}`);
            const watcher = new Watcher({
                mode: args.watch,
                run: (files) => {
                    const child = spawn(
                        process.execPath,
                        [
                            ...process.execArgv,
                            entry,
                            ...args.flags,
                            ...(files?.map(exactly) ?? args.patterns),
                        ],
                        { stdio: ["ignore", "inherit", "inherit"] },
                    );
                    return {
                        done: new Promise((resolve) =>
                            child.on("close", resolve).on("error", resolve),
                        ),
                        stop: () => child.kill(),
                    };
                },
                related: (changed) =>
                    dependencies.related(testero.files(), changed),
                subscribe: (listener) => {
                    const watching = watch(
                        config.root,
                        { recursive: true },
                        (_, name) => {
                            if (name) listener(name.split(sep).join("/"));
                        },
                    );
                    return () => watching.close();
                },
                // sources and JSON, like Jest's moduleFileExtensions, not
                // the coverage a run writes
                ignores: (path) =>
                    config.ignore.matches(path) ||
                    coverage.matches(path) ||
                    (Transformer.loader(path) === undefined &&
                        !path.endsWith(".json")),
                input: process.stdin.isTTY ? process.stdin : undefined,
                clear: process.stdout.isTTY,
            });
            // closing lets the process end, which removes the compiled files
            process.on("exit", () => transformer.dispose());
            for (const signal of ["SIGINT", "SIGTERM"] as const)
                process.once(signal, () => watcher.close());
            watcher.start();
        } else if (!(await testero.run())) process.exitCode = 1;
    }
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
}
