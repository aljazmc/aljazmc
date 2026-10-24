import Config from "@aljazmc/config";
import Arguments from "./arguments.js";
import defaults from "./config.js";
import Testero from "./testero.js";

try {
    if (Config.init("testero", defaults)) process.exit();

    const args = new Arguments(process.argv.slice(2));

    if (args.help) process.stdout.write(Arguments.usage);
    else {
        const config = await Config.load("testero", defaults);
        const testero = new Testero(config, args.options(config.rules));

        if (args.listTests)
            for (const file of testero.files()) console.log(file);
        else if (!(await testero.run())) process.exitCode = 1;
    }
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
}
