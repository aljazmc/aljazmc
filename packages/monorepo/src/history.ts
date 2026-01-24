import type Git from "./git.js";

/**
 * The commits a rebase made, findable by what it keeps of the commits it
 * replaced: the author, author date and subject, or else the change itself.
 */
export default class History {
    /** Every commit in the history of the branch. */
    readonly commits: Set<string>;
    readonly #git: Git;
    readonly #byIdentity: Map<string, string | null>;
    readonly #byPatch: Map<string, string | null>;

    /** The history of a branch, with the commits not reachable from the replaced ones. */
    constructor(git: Git, branch: string, replaced: string[]) {
        this.#git = git;
        this.commits = new Set(
            git.run(["rev-list", branch]).split("\n").filter(Boolean),
        );

        const range = [branch, "--not", ...replaced];
        this.#byIdentity = History.#unique(
            git
                .run([
                    "log",
                    "--format=%H%x00%an%x00%ae%x00%at%x00%s",
                    ...range,
                ])
                .split("\n")
                .filter(Boolean)
                .map((line) => {
                    const [hash, ...identity] = line.split("\x00");
                    return [identity.join("\x00"), hash as string];
                }),
        );
        this.#byPatch = History.#unique(
            this.#patches(["log", "-p", "--format=commit %H", ...range]),
        );
    }

    /** The commit a rebase made from a replaced one, undefined when none is certain. */
    find(commit: string): string | undefined {
        const identity = this.#git
            .run(["log", "-1", "--format=%an%x00%ae%x00%at%x00%s", commit])
            .trimEnd();
        const byIdentity = this.#byIdentity.get(identity);
        if (byIdentity) return byIdentity;

        // a reworded commit keeps its change
        const [[patch] = []] = this.#patches([
            "show",
            "--format=commit %H",
            commit,
        ]);
        return (patch && this.#byPatch.get(patch)) || undefined;
    }

    /** Patch ids of the commits a command prints, as [patch, commit] pairs. */
    #patches(args: string[]): [string, string][] {
        const diff = this.#git.run(args);
        if (diff === "") return [];
        return this.#git
            .run(["patch-id", "--stable"], { input: `${diff}\n` })
            .split("\n")
            .filter(Boolean)
            .map((line) => line.split(" ") as [string, string]);
    }

    /** Keys of exactly one commit, keys of several are ambiguous and map to null. */
    static #unique(pairs: [string, string][]): Map<string, string | null> {
        const map = new Map<string, string | null>();
        for (const [key, hash] of pairs)
            map.set(key, map.has(key) ? null : hash);
        return map;
    }
}
