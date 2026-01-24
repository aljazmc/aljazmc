import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Git from "../../src/git.ts";
import Monorepo from "../../src/monorepo.ts";

describe("monorepo tags", () => {
    let root: string;
    let git: Git;
    let origin: Git;
    let time = 1_700_000_000;

    /** Commits a file change with its own author date. */
    const commit = (file: string, text: string, subject: string): string => {
        writeFileSync(join(root, "work", file), text);
        git.run(["add", file]);
        const date = `${time++} +0000`;
        git.run(["commit", "-q", "-m", subject], {
            env: { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
        });
        return git.run(["rev-parse", "HEAD"]);
    };

    const tagged = (repository: Git, name: string) =>
        repository.run(["rev-parse", `${name}^{commit}`]);

    const monorepo = () =>
        new Monorepo(join(root, "work"), { remote: "origin", branch: "HEAD" });

    beforeAll(() => {
        Object.assign(process.env, {
            GIT_AUTHOR_NAME: "Author",
            GIT_AUTHOR_EMAIL: "author@example.com",
            GIT_COMMITTER_NAME: "Committer",
            GIT_COMMITTER_EMAIL: "committer@example.com",
            GIT_CONFIG_NOSYSTEM: "1",
        });
    });

    /**
     * Commits a, b (tagged v1, lightweight) and c (tagged v2, annotated),
     * pushed with the tags, then rebased: a amended, b reworded, c kept.
     */
    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "monorepo-"));
        new Git(root).run(["init", "-q", "--bare", "-b", "main", "origin.git"]);
        new Git(root).run(["init", "-q", "-b", "main", "work"]);
        origin = new Git(join(root, "origin.git"));
        git = new Git(join(root, "work"));
        git.run(["remote", "add", "origin", join(root, "origin.git")]);

        const a = commit("a.txt", "a\n", "feat: a");
        commit("b.txt", "b\n", "feat: b");
        git.run(["tag", "v1"]);
        commit("c.txt", "c\n", "feat: c");
        git.run(["tag", "-a", "v2", "-m", "release 2\n\nnotes"], {
            env: { GIT_COMMITTER_DATE: "1700000500 +0000" },
        });
        git.run(["push", "-q", "origin", "main", "--tags"]);

        git.run(["checkout", "-q", "--detach", a]);
        git.run(["commit", "-q", "--amend", "-m", "feat: a, amended"]);
        git.run(["cherry-pick", "main~1"]);
        git.run(["commit", "-q", "--amend", "-m", "feat: b, reworded"]);
        git.run(["cherry-pick", "main"]);
        git.run(["checkout", "-q", "-B", "main"]);
    });

    afterEach(() => rmSync(root, { recursive: true, force: true }));

    test("finds tags left on replaced commits and where they belong", () => {
        const { moves } = monorepo().tags();
        expect(moves).toEqual([
            {
                name: "v1",
                from: tagged(git, "v1"),
                to: git.run(["rev-parse", "HEAD~1"]),
                known: true,
                local: true,
                remote: true,
            },
            {
                name: "v2",
                from: tagged(git, "v2"),
                to: git.run(["rev-parse", "HEAD"]),
                known: true,
                local: true,
                remote: true,
            },
        ]);
        // checking changes nothing
        expect(tagged(origin, "v1")).toBe(moves[0]?.from);
    });

    test("write moves local tags, keeping annotations", () => {
        monorepo().tags({ write: true });
        expect(tagged(git, "v1")).toBe(git.run(["rev-parse", "HEAD~1"]));
        expect(tagged(git, "v2")).toBe(git.run(["rev-parse", "HEAD"]));
        expect(git.run(["cat-file", "-t", "v2"])).toBe("tag");
        expect(git.run(["tag", "-l", "--format=%(contents)", "v2"])).toBe(
            "release 2\n\nnotes",
        );
        expect(
            git.run(["tag", "-l", "--format=%(taggerdate:unix)", "v2"]),
        ).toBe("1700000500");

        // the remote still needs the push
        const { moves } = monorepo().tags();
        expect(
            moves.map(({ name, local, remote }) => ({ name, local, remote })),
        ).toEqual([
            { name: "v1", local: false, remote: true },
            { name: "v2", local: false, remote: true },
        ]);
    });

    test("push moves the tags on the remote too", () => {
        monorepo().tags({ push: true });
        expect(tagged(origin, "v1")).toBe(git.run(["rev-parse", "HEAD~1"]));
        expect(tagged(origin, "v2")).toBe(git.run(["rev-parse", "HEAD"]));
        expect(monorepo().tags().moves).toEqual([]);
    });

    test("tags only on the remote are fetched and moved", () => {
        git.run(["tag", "-d", "v2"]);
        const { moves } = monorepo().tags({ push: true });
        expect(moves.map(({ name, local }) => ({ name, local }))).toEqual([
            { name: "v1", local: true },
            { name: "v2", local: true },
        ]);
        expect(tagged(git, "v2")).toBe(git.run(["rev-parse", "HEAD"]));
        expect(git.run(["cat-file", "-t", "v2"])).toBe("tag");
        expect(tagged(origin, "v2")).toBe(git.run(["rev-parse", "HEAD"]));
    });

    test("tags of dropped commits are left alone", () => {
        git.run(["reset", "-q", "--hard", "HEAD~1"]);
        const { moves } = monorepo().tags({ write: true });
        const v2 = moves.find((move) => move.name === "v2");
        expect(v2?.to).toBeUndefined();
        expect(tagged(git, "v2")).toBe(v2?.from);
    });

    test("tags in the history of the branch are fine", () => {
        git.run(["reset", "-q", "--hard", "v2"]);
        expect(monorepo().tags().moves).toEqual([]);
    });
});
