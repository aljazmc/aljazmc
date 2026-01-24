import Config from "@aljazmc/config";
import defaults from "./config.js";
import Monorepo from "./monorepo.js";

const usage = `Usage: monorepo tags [--write] [--push] [--remote <name>] [--branch <name>]

Finds tags, locally and on the remote, left on commits that a rebase replaced,
and the rebased commits they belong to.

  --write    move the local tags to the rebased commits
  --push     also force push the moved tags to the remote
  --remote   the remote to check, origin by default
  --branch   the branch tags must be in, HEAD by default
`;

try {
    const [command, ...args] = process.argv.slice(2);
    if (command !== "tags") {
        process.stdout.write(usage);
        if (command !== undefined && command !== "--help" && command !== "-h")
            process.exitCode = 1;
    } else {
        const config = await Config.load("monorepo", defaults);
        const rules = { ...config.rules };
        const options = { write: false, push: false };
        for (let index = 0; index < args.length; index++) {
            const arg = args[index];
            if (arg === "--write") options.write = true;
            else if (arg === "--push") options.push = true;
            else if (arg === "--remote" || arg === "--branch")
                rules[arg.slice(2) as "remote" | "branch"] =
                    args[++index] ?? "";
            else throw new Error(`Unknown option ${arg}.`);
        }

        const { moves, unsigned } = new Monorepo(config.root, rules).tags(
            options,
        );
        const short = (hash: string | undefined) => hash?.slice(0, 7) ?? "?";
        const changed = options.write || options.push;

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
            const done =
                (!move.local || changed) && (!move.remote || options.push);
            if (!done) process.exitCode = 1;
            console.log(
                `${done ? "moved" : "mangled"}: ${move.name} ${short(move.from)} -> ${short(move.to)} (${places.join(", ")})`,
            );
        }
        for (const name of unsigned)
            console.log(
                `warning: ${name} was signed, it is moved without its signature`,
            );
        if (moves.length === 0)
            console.log("All tags are in the history of the branch.");
        else if (!changed)
            console.log(
                "Run with --write to move local tags, and --push to update the remote.",
            );
    }
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
}
