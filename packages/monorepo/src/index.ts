import Config from "@aljazmc/config";
import defaults from "./config.js";
import Monorepo from "./monorepo.js";

const usage = `Usage: monorepo [<command>] [--write] [--push] [--dry-run] [--remote <name>] [--branch <name>]

Without a command, monorepo runs tags, then version: tags left on commits a
rebase replaced are moved first, so versions count only the new commits.

Commands:
  version   bumps the versions of the packages that changed since their last
            version, by conventional commits, then commits and tags each one
  tags      finds tags, locally and on the remote, left on commits that a
            rebase replaced, and the rebased commits they belong to

  --write    version: commit and tag the new versions
             tags: move the local tags to the rebased commits
  --push     also push the branch and the new tags, or force push moved tags
  --dry-run  print what --write and --push would do, without changing
             files, making commits or pushing
  --remote   the remote to push to, origin by default
  --branch   the branch tags must be in, or to push to, HEAD by default
`;

interface Options {
    write: boolean;
    push: boolean;
    dryRun: boolean;
}

/** An argument as typed in a shell, quoted when needed. */
const quote = (arg: string) =>
    /^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", "'\\''")}'`;

/** Runs the version command, printing the releases, and with dry run the steps. */
const version = (monorepo: Monorepo, options: Options) => {
    // a dry run shows what --write would do, and --push with it
    const write = options.write || options.push || options.dryRun;
    const { releases, steps } = monorepo.version({ ...options, write });
    const done = write && !options.dryRun;
    const would = options.dryRun ? "would " : "";
    for (const release of releases)
        console.log(
            release.level
                ? `${would}${done ? "released" : "release"}: ${release.name} ${release.from} -> ${release.to} (${release.level}, ${release.tag})`
                : `${would}${done ? "tagged" : "tag"}: ${release.name} ${release.to} (${release.tag})`,
        );
    if (options.dryRun)
        for (const step of steps)
            console.log(
                step.type === "file"
                    ? `would write: ${step.file} ("version": "${step.version}")`
                    : `would run: git ${step.args.map(quote).join(" ")}`,
            );
    if (releases.length === 0)
        console.log("No package changed since its last version.");
    else if (!write)
        console.log(
            "Run with --write to commit and tag the versions, and --push to push them.",
        );
};

try {
    const argv = process.argv.slice(2);
    // without a command, the options are for both
    const command = argv[0]?.startsWith("--") ? undefined : argv[0];
    const args = command === undefined ? argv : argv.slice(1);
    if (
        (command !== undefined &&
            command !== "tags" &&
            command !== "version") ||
        args.includes("--help") ||
        args.includes("-h")
    ) {
        process.stdout.write(usage);
        if (
            command !== "--help" &&
            command !== "-h" &&
            !args.includes("--help") &&
            !args.includes("-h")
        )
            process.exitCode = 1;
    } else {
        const config = await Config.load("monorepo", defaults);
        const rules = { ...config.rules };
        const options = { write: false, push: false, dryRun: false };
        for (let index = 0; index < args.length; index++) {
            const arg = args[index];
            if (arg === "--write") options.write = true;
            else if (arg === "--push") options.push = true;
            else if (arg === "--dry-run") options.dryRun = true;
            else if (arg === "--remote" || arg === "--branch")
                rules[arg.slice(2) as "remote" | "branch"] =
                    args[++index] ?? "";
            else throw new Error(`Unknown option ${arg}.`);
        }

        // like the other settings, the ignore of the config file replaces the default
        const monorepo = new Monorepo(
            config.root,
            rules,
            config.custom.ignore ?? defaults.ignore,
        );
        if (command !== "version") tags(monorepo, rules, options);
        if (command !== "tags") version(monorepo, options);
    }
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
}

/** Runs the tags command, printing the moves. */
function tags(
    monorepo: Monorepo,
    rules: { remote: string; branch: string },
    options: Options,
) {
    // a dry run reports the moves without making them
    const { moves, unsigned } = monorepo.tags(
        options.dryRun ? { write: false, push: false } : options,
    );
    const short = (hash: string | undefined) => hash?.slice(0, 7) ?? "?";
    const changed = (options.write || options.push) && !options.dryRun;
    const would = options.dryRun && (options.write || options.push);

    for (const move of moves) {
        if (!move.to) {
            process.exitCode = 1;
            console.log(
                move.known
                    ? `unresolved: ${move.name} ${short(move.from)} has no rebased commit in ${rules.branch}`
                    : `unresolved: ${move.name} ${short(move.from)} is only on ${rules.remote}, fetch it first`,
            );
            continue;
        }
        const places = [
            ...(move.local ? ["local"] : []),
            ...(move.remote ? [rules.remote] : []),
        ];
        const pushed = options.push && !options.dryRun;
        const done = (!move.local || changed) && (!move.remote || pushed);
        // what the options would move without the dry run
        const planned =
            would &&
            (!move.local || options.write || options.push) &&
            (!move.remote || options.push);
        if (!done) process.exitCode = 1;
        console.log(
            `${done ? "moved" : planned ? "would move" : "mangled"}: ${move.name} ${short(move.from)} -> ${short(move.to)} (${places.join(", ")})`,
        );
    }
    for (const name of unsigned)
        console.log(
            `warning: ${name} was signed, it is moved without its signature`,
        );
    if (moves.length === 0)
        console.log("All tags are in the history of the branch.");
    else if (!changed && !would)
        console.log(
            "Run with --write to move local tags, and --push to update the remote.",
        );
}
