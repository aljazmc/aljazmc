import { execFileSync } from "node:child_process";
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
    bump,
    development,
    latest,
    level,
    notes,
    packages,
    plan,
    write,
} from "../release.ts";

describe("release", () => {
    let root: string;
    const git = (...args: string[]) =>
        execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
    const file = (path: string, text: string) => {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), text);
    };
    const manifest = (dir: string, name: string, extra: object = {}) =>
        file(
            `${dir}/package.json`,
            `${JSON.stringify({ name, version: development, ...extra }, null, 4)}\n`,
        );
    const commit = (message: string, path = "README.md") => {
        file(path, `${message}\n${Math.random()}\n`);
        git("add", "-A");
        git("commit", "-q", "-m", message);
    };
    const tag = (name: string) => git("tag", "-a", name, "-m", name);

    beforeAll(() => {
        // a committer for the commits and annotated tags of the tests
        for (const kind of ["AUTHOR", "COMMITTER"]) {
            process.env[`GIT_${kind}_NAME`] = "test";
            process.env[`GIT_${kind}_EMAIL`] = "test@example.org";
        }
        process.env.GIT_CONFIG_NOSYSTEM = "1";
    });

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "release-"));
        git("init", "-q", "-b", "main");
        file("package.json", '{ "name": "root", "private": true }\n');
        manifest("shared/config", "@x/config");
        manifest("packages/b", "@x/b");
        manifest("packages/a", "@x/a", {
            dependencies: { "@x/config": "workspace:^" },
        });
        manifest("packages/hidden", "@x/hidden", { private: true });
        commit("chore: start");
        for (const name of ["@x/config@0.3.0", "@x/a@0.9.0", "@x/b@1.2.0"])
            tag(name);
    });

    afterEach(() => rmSync(root, { recursive: true, force: true }));

    test("the published packages, each after what it depends on", () => {
        expect(packages(root).map(({ name }) => name)).toEqual([
            "@x/config",
            "@x/a",
            "@x/b",
        ]);
        expect(packages(root)[1]).toEqual({
            name: "@x/a",
            dir: "packages/a",
            workspace: ["@x/config"],
        });
    });

    test("bumps like semver, a breaking change before 1.0.0 is minor", () => {
        expect(bump("0.9.6", "patch")).toBe("0.9.7");
        expect(bump("0.9.6", "minor")).toBe("0.10.0");
        expect(bump("0.9.6", "major")).toBe("0.10.0");
        expect(bump("1.2.3", "major")).toBe("2.0.0");
        expect(bump("1.2.3", "minor")).toBe("1.3.0");
    });

    test("the level is the highest the conventional commits call for", () => {
        const of = (...subjects: string[]) =>
            level(subjects.map((subject) => ({ hash: "", subject, body: "" })));
        expect(of("style: a", "test: b", "build: c", "ci: d")).toBeUndefined();
        expect(of("docs: a", "chore(x): b")).toBe("patch");
        expect(of("fix: a", "feat(lintero): b")).toBe("minor");
        expect(of("feat!: a")).toBe("major");
        expect(
            level([
                { hash: "", subject: "fix: a", body: "BREAKING CHANGE: b" },
            ]),
        ).toBe("major");
        expect(of("not conventional")).toBeUndefined();
    });

    test("nothing is due without commits that release", () => {
        commit("style: format", "packages/a/a.ts");
        commit("test: more", "packages/b/tests/b.test.ts");
        commit("docs: the root", "README.md");
        expect(plan(root)).toEqual([]);
    });

    test("a change releases its package, and through a dependency what uses it", () => {
        commit("fix: config", "shared/config/src/index.ts");
        commit("feat: b", "packages/b/src/index.ts");
        commit("version: update @x/b to v1.2.1", "packages/b/version.txt");
        expect(plan(root)).toEqual([
            {
                name: "@x/config",
                dir: "shared/config",
                from: "0.3.0",
                to: "0.3.1",
                level: "patch",
                tag: "@x/config@0.3.1",
                commits: ["fix: config"],
            },
            {
                name: "@x/a",
                dir: "packages/a",
                from: "0.9.0",
                to: "0.9.1",
                level: "patch",
                tag: "@x/a@0.9.1",
                commits: ["fix: config"],
            },
            {
                name: "@x/b",
                dir: "packages/b",
                from: "1.2.0",
                to: "1.3.0",
                level: "minor",
                tag: "@x/b@1.3.0",
                commits: ["feat: b"],
            },
        ]);
    });

    test("counts from the newest tag, and a package without one starts at 0.1.0", () => {
        commit("fix: a", "packages/a/src/a.ts");
        tag("@x/a@0.9.1");
        tag("@x/a@0.10.0-beta.1");
        commit("fix: a again", "packages/a/src/a.ts");
        manifest("packages/c", "@x/c");
        commit("feat: c", "packages/c/src/c.ts");
        const due = plan(root);
        expect(due.map(({ tag }) => tag)).toEqual(["@x/a@0.9.2", "@x/c@0.1.0"]);
        expect(due[1]?.from).toBeUndefined();
    });

    test("writes the versions in, released or last, and keeps the rest of package.json", () => {
        commit("feat: b", "packages/b/src/index.ts");
        const before = readFileSync(
            join(root, "packages/a/package.json"),
            "utf8",
        );
        expect(write(root, plan(root))).toEqual([
            "@x/config 0.3.0",
            "@x/a 0.9.0",
            "@x/b 1.3.0",
        ]);
        expect(
            readFileSync(join(root, "packages/a/package.json"), "utf8"),
        ).toBe(before.replace(development, "0.9.0"));
        expect(
            JSON.parse(
                readFileSync(join(root, "packages/b/package.json"), "utf8"),
            ).version,
        ).toBe("1.3.0");
        // a private package is left as it is
        expect(
            readFileSync(join(root, "packages/hidden/package.json"), "utf8"),
        ).toContain(development);
    });

    test("notes list the commits since the version before, by kind", () => {
        commit("feat: rules", "packages/a/src/rules.ts");
        commit("fix(config): paths", "shared/config/src/index.ts");
        commit("feat!: drop an option", "packages/a/src/options.ts");
        commit("test: more", "packages/a/tests/a.test.ts");
        commit("docs: b only", "packages/b/README.md");
        commit("version: update @x/a to v0.10.0", "packages/a/version.txt");
        tag("@x/a@0.10.0");
        const hash = git("log", "-1", "--format=%h", "HEAD~2");
        expect(
            notes(root, "@x/a@0.10.0", { environment: "Built with Node 26." }),
        ).toBe(
            [
                "[@x/a 0.10.0 on npm](https://www.npmjs.com/package/@x/a/v/0.10.0) · [changes since 0.9.0](https://github.com/aljazmc/aljazmc/compare/%40x%2Fa%400.9.0...%40x%2Fa%400.10.0)",
                "",
                "### Breaking changes",
                "",
                `- drop an option (${git("log", "-1", "--format=%h", "HEAD~3")})`,
                "",
                "### Features",
                "",
                `- rules (${git("log", "-1", "--format=%h", "HEAD~5")})`,
                "",
                "### Fixes",
                "",
                `- paths (${git("log", "-1", "--format=%h", "HEAD~4")})`,
                "",
                "### Other changes",
                "",
                `- more (${hash})`,
                "",
                "Built with Node 26.",
                "",
            ].join("\n"),
        );
    });

    test("the notes of a first release, and of one without changes", () => {
        expect(notes(root, "@x/b@1.2.0")).toContain("- start (");
        tag("@x/b@1.2.1");
        expect(notes(root, "@x/b@1.2.1")).toContain(
            "No changes since the version before.",
        );
        expect(() => notes(root, "@x/nope@1.0.0")).toThrow(
            "No package is named @x/nope.",
        );
    });

    test("the last tag of each package", () => {
        tag("@x/config@0.3.1");
        expect(latest(root)).toEqual([
            "@x/config@0.3.1",
            "@x/a@0.9.0",
            "@x/b@1.2.0",
        ]);
    });
});
