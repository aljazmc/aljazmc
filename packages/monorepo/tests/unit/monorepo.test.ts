import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import defaults from "../../src/config.ts";
import Git from "../../src/git.ts";
import Monorepo from "../../src/monorepo.ts";
import type { Rules } from "../../src/rules.ts";
import { bump } from "../../src/versions.ts";

beforeAll(() => {
    Object.assign(process.env, {
        GIT_AUTHOR_NAME: "Author",
        GIT_AUTHOR_EMAIL: "author@example.com",
        GIT_COMMITTER_NAME: "Committer",
        GIT_COMMITTER_EMAIL: "committer@example.com",
        GIT_CONFIG_NOSYSTEM: "1",
    });
});

/** A working repository with an empty bare one as origin, in a new temporary folder. */
const repository = () => {
    const root = mkdtempSync(join(tmpdir(), "monorepo-"));
    new Git(root).run(["init", "-q", "--bare", "-b", "main", "origin.git"]);
    new Git(root).run(["init", "-q", "-b", "main", "work"]);
    const git = new Git(join(root, "work"));
    git.run(["remote", "add", "origin", join(root, "origin.git")]);
    return { root, git, origin: new Git(join(root, "origin.git")) };
};

describe("bump", () => {
    test("bumps by semantic versioning, breaking changes the minor version before 1.0.0", () => {
        expect(bump("1.2.3", "patch")).toBe("1.2.4");
        expect(bump("1.2.3", "minor")).toBe("1.3.0");
        expect(bump("1.2.3", "major")).toBe("2.0.0");
        expect(bump("0.2.3", "major")).toBe("0.3.0");
        expect(bump("0.0.1", "patch")).toBe("0.0.2");
        // prereleases and build metadata end with the release
        expect(bump("1.2.3-beta.1+build", "patch")).toBe("1.2.4");
    });
});

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

    const monorepo = () => new Monorepo(join(root, "work"), defaults.rules);

    /**
     * Commits a, b (tagged v1, lightweight) and c (tagged v2, annotated),
     * pushed with the tags, then rebased: a amended, b reworded, c kept.
     */
    beforeEach(() => {
        ({ root, git, origin } = repository());

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

describe("monorepo version", () => {
    let root: string;
    let git: Git;
    let origin: Git;

    const write = (file: string, text: string) => {
        mkdirSync(dirname(join(root, "work", file)), { recursive: true });
        writeFileSync(join(root, "work", file), text);
    };
    const manifest = (name: string, version: string, extra = {}) =>
        `${JSON.stringify({ name, version, ...extra }, null, 4)}\n`;
    const commit = (file: string, subject: string, body = "") => {
        write(file, `${subject}\n`);
        git.run(["add", "--", file]);
        git.run([
            "commit",
            "-q",
            "-m",
            body ? `${subject}\n\n${body}` : subject,
        ]);
    };
    const version = (file: string) =>
        JSON.parse(readFileSync(join(root, "work", file), "utf8")).version;
    const monorepo = (rules: Partial<Rules> = {}, ignore?: string[]) =>
        new Monorepo(
            join(root, "work"),
            { ...defaults.rules, packages: [".", "packages/*"], ...rules },
            ignore,
        );
    const plan = (rules: Partial<Rules> = {}, ignore?: string[]) =>
        monorepo(rules, ignore)
            .version()
            .releases.map(({ name, from, to, level, tag }) => ({
                name,
                from,
                to,
                level,
                tag,
            }));

    /**
     * A root package at 1.0.0, packages a at 0.1.0, depending on the shared
     * workspace, and b at 1.2.3, each released and tagged, pushed to origin.
     */
    beforeEach(() => {
        ({ root, git, origin } = repository());

        write("package.json", manifest("root", "1.0.0", { private: true }));
        write(
            "packages/a/package.json",
            manifest("@x/a", "0.1.0", {
                devDependencies: { "@x/shared": "workspace:*" },
            }),
        );
        write("packages/b/package.json", manifest("@x/b", "1.2.3"));
        write("shared/s/package.json", manifest("@x/shared", "0.0.0"));
        write("node_modules/c/package.json", manifest("c", "1.0.0"));
        write(".gitignore", "node_modules\n");
        git.run(["add", "."]);
        git.run(["commit", "-q", "-m", "feat: packages"]);
        for (const tag of ["v1.0.0", "@x/a@0.1.0", "@x/b@1.2.3"])
            git.run(["tag", "-a", tag, "-m", tag]);
        git.run(["push", "-q", "origin", "main", "--tags"]);
    });

    afterEach(() => rmSync(root, { recursive: true, force: true }));

    test("nothing changed, nothing is released", () => {
        expect(plan()).toEqual([]);
    });

    test("fixes bump the patch version of the packages they change", () => {
        commit("packages/a/src.ts", "fix: a");
        expect(plan()).toEqual([
            {
                name: "@x/a",
                from: "0.1.0",
                to: "0.1.1",
                level: "patch",
                tag: "@x/a@0.1.1",
            },
        ]);
    });

    test("features bump the minor version, also of the packages depending on the changed workspace", () => {
        commit("shared/s/src.ts", "feat: shared");
        commit("packages/b/src.ts", "fix(b): b");
        expect(plan()).toEqual([
            {
                name: "@x/a",
                from: "0.1.0",
                to: "0.2.0",
                level: "minor",
                tag: "@x/a@0.2.0",
            },
            {
                name: "@x/b",
                from: "1.2.3",
                to: "1.2.4",
                level: "patch",
                tag: "@x/b@1.2.4",
            },
        ]);
    });

    test("breaking changes bump the major version, the minor one before 1.0.0", () => {
        commit("packages/a/src.ts", "feat!: a");
        commit("packages/b/src.ts", "refactor: b", "BREAKING CHANGE: b");
        expect(plan().map(({ name, to }) => ({ name, to }))).toEqual([
            { name: "@x/a", to: "0.2.0" },
            { name: "@x/b", to: "2.0.0" },
        ]);
    });

    test("the root package has the changes outside of the packages, with a plain tag", () => {
        commit(".github/workflows/cicd.yml", "fix: workflow");
        commit("packages/b/README.md", "docs: b");
        expect(plan()).toEqual([
            {
                name: "root",
                from: "1.0.0",
                to: "1.0.1",
                level: "patch",
                tag: "v1.0.1",
            },
        ]);
        expect(plan({ packages: ["packages/*"] })).toEqual([]);
    });

    test("versions without a tag are tagged as they are", () => {
        write("packages/b/package.json", manifest("@x/b", "1.3.0"));
        git.run(["commit", "-q", "-am", "feat: b 1.3.0"]);
        expect(plan()).toEqual([
            {
                name: "@x/b",
                from: "1.3.0",
                to: "1.3.0",
                level: undefined,
                tag: "@x/b@1.3.0",
            },
        ]);
    });

    test("write commits and tags each version on its own", () => {
        commit("packages/a/src.ts", "fix: a");
        commit("packages/b/src.ts", "feat: b");
        const head = git.run(["rev-parse", "HEAD"]);
        monorepo().version({ write: true });

        expect(version("packages/a/package.json")).toBe("0.1.1");
        expect(version("packages/b/package.json")).toBe("1.3.0");
        expect(
            readFileSync(join(root, "work/packages/b/package.json"), "utf8"),
        ).toBe(manifest("@x/b", "1.3.0"));
        expect(
            git.run(["log", "--format=%s", `${head}..HEAD`]).split("\n"),
        ).toEqual([
            "version: update @x/b to v1.3.0",
            "version: update @x/a to v0.1.1",
        ]);
        expect(git.run(["rev-parse", "@x/b@1.3.0^{commit}"])).toBe(
            git.run(["rev-parse", "HEAD"]),
        );
        expect(git.run(["rev-parse", "@x/a@0.1.1^{commit}"])).toBe(
            git.run(["rev-parse", "HEAD~1"]),
        );
        expect(git.run(["cat-file", "-t", "@x/a@0.1.1"])).toBe("tag");
        // the version commits release nothing again
        expect(plan()).toEqual([]);
    });

    test("push pushes the branch with the new tags", () => {
        commit("packages/a/src.ts", "fix: a");
        monorepo().version({ push: true });
        expect(origin.run(["rev-parse", "main"])).toBe(
            git.run(["rev-parse", "HEAD"]),
        );
        expect(origin.run(["rev-parse", "@x/a@0.1.1^{commit}"])).toBe(
            git.run(["rev-parse", "HEAD"]),
        );
    });

    test("a dry run returns the steps without changing anything", () => {
        commit("packages/a/src.ts", "fix: a");
        const head = git.run(["rev-parse", "HEAD"]);
        const { steps } = monorepo().version({ push: true, dryRun: true });
        expect(steps).toEqual([
            {
                type: "file",
                file: "packages/a/package.json",
                text: manifest("@x/a", "0.1.1", {
                    devDependencies: { "@x/shared": "workspace:*" },
                }),
                version: "0.1.1",
            },
            { type: "git", args: ["add", "--", "packages/a/package.json"] },
            {
                type: "git",
                args: [
                    "commit",
                    "-q",
                    "-m",
                    "version: update @x/a to v0.1.1",
                    "--",
                    "packages/a/package.json",
                ],
            },
            {
                type: "git",
                args: [
                    "tag",
                    "-a",
                    "@x/a@0.1.1",
                    "-m",
                    "version: update @x/a to v0.1.1",
                ],
            },
            {
                type: "git",
                args: [
                    "push",
                    "-q",
                    "--atomic",
                    "origin",
                    "HEAD",
                    "refs/tags/@x/a@0.1.1",
                ],
            },
        ]);
        expect(version("packages/a/package.json")).toBe("0.1.0");
        expect(git.run(["rev-parse", "HEAD"])).toBe(head);
        expect(git.run(["tag", "-l", "@x/a@0.1.1"])).toBe("");
        expect(origin.run(["rev-parse", "main"])).toBe(
            origin.run(["rev-parse", "@x/a@0.1.0^{commit}"]),
        );
    });

    test("existing tags are not overwritten", () => {
        commit("packages/a/src.ts", "fix: a");
        git.run(["tag", "@x/a@0.1.1"]);
        expect(() => monorepo().version({ write: true })).toThrow(
            "The tag @x/a@0.1.1 exists already.",
        );
        expect(version("packages/a/package.json")).toBe("0.1.0");
    });

    test("chores, documentation and other commits do not bump", () => {
        commit("packages/a/src.ts", "chore: a");
        commit("packages/a/README.md", "docs: a");
        commit("packages/a/x.ts", "not conventional");
        expect(plan()).toEqual([]);
        expect(
            plan({ bump: { ...defaults.rules.bump, docs: "patch" } }).map(
                ({ to }) => to,
            ),
        ).toEqual(["0.1.1"]);
    });

    test("ignored folders hold no packages", () => {
        write("vendor/v/package.json", manifest("@x/v", "1.0.0"));
        git.run(["add", "."]);
        git.run(["commit", "-q", "-m", "feat: vendor"]);
        // the untagged versions of the packages found are tagged
        const names = (ignore?: string[]) =>
            plan({ packages: ["*/*"] }, ignore).map(({ name }) => name);
        // node_modules is ignored by default
        expect(names()).toEqual(["@x/shared", "@x/v"]);
        expect(names([".git", "node_modules", "vendor"])).toEqual([
            "@x/shared",
        ]);
    });

    test("folders of a package are part of it, not packages of their own", () => {
        write("packages/a/fixtures/package.json", manifest("fixture", "1.0.0"));
        git.run(["add", "."]);
        git.run(["commit", "-q", "-m", "fix: a fixture"]);
        expect(plan({ packages: ["packages/**"] })).toEqual([
            {
                name: "@x/a",
                from: "0.1.0",
                to: "0.1.1",
                level: "patch",
                tag: "@x/a@0.1.1",
            },
        ]);
    });

    test("messages and tags follow their settings", () => {
        commit("packages/a/src.ts", "fix: a");
        commit("README.md", "feat: docs");
        const rules = {
            message: "chore(release): {name} {version}",
            tag: "{name}/v{version}",
            rootTag: "release-{version}",
        };
        for (const tag of ["@x/a/v0.1.0", "@x/b/v1.2.3", "release-1.0.0"])
            git.run(["tag", tag, "HEAD~2"]);
        monorepo(rules).version({ write: true });
        expect(git.run(["log", "-2", "--format=%s"]).split("\n")).toEqual([
            "chore(release): @x/a 0.1.1",
            "chore(release): root 1.1.0",
        ]);
        expect(
            git.run(["tag", "-l", "@x/a/v0.1.1", "release-1.1.0"]).split("\n"),
        ).toEqual(["@x/a/v0.1.1", "release-1.1.0"]);
        // its own commits are known by the message setting
        expect(plan(rules)).toEqual([]);
    });

    test("push pushes to the branch setting", () => {
        commit("packages/a/src.ts", "fix: a");
        monorepo({ branch: "release" }).version({ push: true });
        expect(origin.run(["rev-parse", "release"])).toBe(
            git.run(["rev-parse", "HEAD"]),
        );
        expect(origin.run(["rev-parse", "main"])).not.toBe(
            git.run(["rev-parse", "HEAD"]),
        );
    });
});
