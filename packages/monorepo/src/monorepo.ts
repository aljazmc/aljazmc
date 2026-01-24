import Git from "./git.js";
import type { Rules } from "./rules.js";
import Tags, { type Move } from "./tags.js";

/** What the tags command did, for each tag that was off the branch. */
export interface Report {
    moves: Move[];
    /** Signed tags lose their signature when moved. */
    unsigned: string[];
}

/** Monorepo maintenance, run on the repository in a directory. */
export default class Monorepo {
    readonly #git: Git;
    readonly #rules: Rules;

    constructor(directory: string, rules: Rules) {
        this.#git = new Git(directory);
        this.#rules = rules;
    }

    /**
     * Finds tags, locally and on the remote, left on commits a rebase replaced.
     * With write, moves the local ones to the rebased commits, with push the
     * ones on the remote too.
     */
    tags({ write = false, push = false } = {}): Report {
        const tags = new Tags(
            this.#git,
            this.#rules.remote,
            this.#rules.branch,
        );
        const moves = tags.plan();
        const signed = new Set(
            this.#git
                .tags()
                .filter((tag) => tag.annotation?.signed)
                .map((tag) => tag.name),
        );
        const report = {
            moves,
            unsigned: moves
                .filter(
                    (move) => move.to && move.local && signed.has(move.name),
                )
                .map((move) => move.name),
        };

        if (write || push) tags.write(moves);
        if (push) tags.push(moves);
        return report;
    }
}
