import Config from "@aljazmc/config";
import defaults from "./config.js";
import Git from "./git.js";
import type { Rules } from "./rules.js";
import Tags, { type Move } from "./tags.js";
import Versions, { type Release, type Step } from "./versions.js";

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
    readonly #config: Config<Rules>;

    /** With the files to ignore when looking for packages, like `node_modules`. */
    constructor(directory: string, rules: Rules, ignore = defaults.ignore) {
        this.#git = new Git(directory);
        this.#rules = rules;
        this.#config = new Config({ ignore, rules }, directory);
    }

    /**
     * Finds the packages whose files changed since their last version, by
     * conventional commits: `feat` bumps the minor version, `fix`, `chore`
     * and `docs` the patch one, a breaking change the major one, by the bump
     * setting. Versions in package.json without
     * a tag count from the commit that set them, and are tagged as they are
     * when nothing since calls for a bump. With write, each version is committed
     * and tagged on its own, with push the branch and the tags are pushed.
     * With dry run, nothing changes, the steps are only returned.
     */
    version({ write = false, push = false, dryRun = false } = {}): {
        releases: Release[];
        steps: Step[];
    } {
        const versions = new Versions(this.#git, this.#config);
        const releases = versions.plan();
        const steps = write || push ? versions.steps(releases, { push }) : [];
        if (!dryRun) versions.run(steps);
        return { releases, steps };
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
