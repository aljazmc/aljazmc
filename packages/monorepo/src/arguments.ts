/** What the command line asks for. */
export interface Arguments {
    /** `tags`, `version`, or undefined for both. */
    command: "tags" | "version" | undefined;
    write: boolean;
    push: boolean;
    dryRun: boolean;
    /** Settings given on the command line, they override the config file. */
    rules: { remote?: string; branch?: string };
    /** Whether to print the usage instead, with `--help` or an unknown command. */
    help: boolean;
    /** Whether the usage is printed because the command line is wrong. */
    wrong: boolean;
}

/** Reads the arguments of the command line, after the program name. */
export function parse(argv: string[]): Arguments {
    // without a command, the options are for both
    const first = argv[0];
    const named = first !== undefined && !first.startsWith("-");
    const args = named ? argv.slice(1) : argv;
    const help = args.includes("--help") || args.includes("-h");
    const result: Arguments = {
        command: undefined,
        write: false,
        push: false,
        dryRun: false,
        rules: {},
        help,
        wrong: false,
    };
    if (named) {
        if (first === "tags" || first === "version") result.command = first;
        else return { ...result, help: true, wrong: true };
    }
    if (help) return result;

    for (let index = 0; index < args.length; index++) {
        const arg = args[index] as string;
        if (arg === "--write") result.write = true;
        else if (arg === "--push") result.push = true;
        else if (arg === "--dry-run") result.dryRun = true;
        else if (arg === "--remote" || arg === "--branch") {
            const value = args[++index];
            if (value === undefined || value === "" || value.startsWith("-"))
                throw new Error(`${arg} needs a name.`);
            result.rules[arg === "--remote" ? "remote" : "branch"] = value;
        } else throw new Error(`Unknown option ${arg}.`);
    }
    return result;
}
