import type Git from "./git.js";
import type { Tag } from "./git.js";
import History from "./history.js";

/** A tag that points outside of the branch, and where it belongs now. */
export interface Move {
    name: string;
    /** The commit the tag points to, locally or else on the remote. */
    from: string;
    /** The rebased commit, undefined when it cannot be found. */
    to: string | undefined;
    /** Whether the stale commit is here, a tag only on the remote may need a fetch. */
    known: boolean;
    /** Whether the local tag needs to move, or to be created from the remote one. */
    local: boolean;
    /** Whether the tag on the remote needs to move. */
    remote: boolean;
}

/** Finds tags left on the commits a rebase replaced, and moves them to the new ones. */
export default class Tags {
    readonly #git: Git;
    readonly #remote: string;
    readonly #branch: string;

    constructor(git: Git, remote: string, branch: string) {
        this.#git = git;
        this.#remote = remote;
        this.#branch = branch;
    }

    /** The tags, local or on the remote, that are not in the history of the branch. */
    plan(): Move[] {
        const local = new Map(
            this.#git.tags().map((tag) => [tag.name, tag.commit]),
        );
        const remote = this.#git.remoteTags(this.#remote);
        const names = [...new Set([...local.keys(), ...remote.keys()])].sort();
        const head = new Set(
            this.#git
                .run(["rev-list", this.#branch])
                .split("\n")
                .filter(Boolean),
        );

        // commits tags point to outside the branch, the ones a rebase replaced
        const replaced = names
            .flatMap((name) => [local.get(name), remote.get(name)])
            .filter(
                (commit): commit is string =>
                    commit !== undefined &&
                    !head.has(commit) &&
                    this.#git.commit(commit) !== undefined,
            );
        const history =
            replaced.length > 0
                ? new History(this.#git, this.#branch, [...new Set(replaced)])
                : undefined;

        const moves: Move[] = [];
        for (const name of names) {
            const ours = local.get(name);
            const theirs = remote.get(name);
            const commits = [ours, theirs].filter(
                (commit) => commit !== undefined,
            );
            const stale = commits.find((commit) => !head.has(commit));
            if (stale === undefined) continue;

            // a tag already moved on one side shows where it belongs on the other
            const known = this.#git.commit(stale) !== undefined;
            const to =
                commits.find((commit) => head.has(commit)) ??
                (known ? history?.find(stale) : undefined);
            moves.push({
                name,
                from: stale,
                to,
                known,
                local: ours !== to,
                remote: theirs !== undefined && theirs !== to,
            });
        }
        return moves;
    }

    /** Moves the local tags, keeping annotations and their taggers. */
    write(moves: Move[]): void {
        const tags = new Map(this.#git.tags().map((tag) => [tag.name, tag]));
        for (const move of moves) {
            if (!move.to || !move.local) continue;
            // a tag only on the remote is fetched first, for its annotation
            if (!tags.has(move.name)) {
                this.#git.run([
                    "fetch",
                    "--no-tags",
                    this.#remote,
                    `refs/tags/${move.name}:refs/tags/${move.name}`,
                ]);
                const [fetched] = this.#git
                    .tags()
                    .filter((tag) => tag.name === move.name);
                if (fetched) tags.set(move.name, fetched);
            }
            this.#retag(
                tags.get(move.name) ?? { name: move.name, commit: move.from },
                move.to,
            );
        }
    }

    /** Force pushes the moved tags to the remote. */
    push(moves: Move[]): void {
        const names = moves
            .filter((move) => move.to && move.remote)
            .map((move) => `refs/tags/${move.name}`);
        if (names.length > 0)
            this.#git.run(["push", "--force", this.#remote, ...names]);
    }

    #retag(tag: Tag, commit: string): void {
        const { annotation } = tag;
        if (!annotation) {
            this.#git.run(["tag", "--force", tag.name, commit]);
            return;
        }
        this.#git.run(
            [
                "tag",
                "--force",
                "--annotate",
                "--cleanup=verbatim",
                "--file=-",
                tag.name,
                commit,
            ],
            {
                input: annotation.message,
                env: {
                    GIT_COMMITTER_NAME: annotation.tagger.name,
                    GIT_COMMITTER_EMAIL: annotation.tagger.email,
                    GIT_COMMITTER_DATE: annotation.tagger.date,
                },
            },
        );
    }
}
