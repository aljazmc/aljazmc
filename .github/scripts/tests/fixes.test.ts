import { execFileSync } from "node:child_process";
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { check, type Fix, fixes, folders, isTest } from "../fixes.ts";

describe("fixes", () => {
    let root: string;
    const git = (...args: string[]) =>
        execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
    const write = (files: Record<string, string>) => {
        for (const [path, text] of Object.entries(files)) {
            mkdirSync(dirname(join(root, path)), { recursive: true });
            writeFileSync(join(root, path), text);
        }
    };
    const commit = (
        message: string,
        files: Record<string, string>,
        date = "2026-11-29T10:00:00Z",
    ) => {
        write(files);
        git("add", "-A");
        process.env.GIT_COMMITTER_DATE = date;
        process.env.GIT_AUTHOR_DATE = date;
        git("commit", "-q", "-m", message);
        return git("rev-parse", "HEAD");
    };
    const read = (path: string) =>
        existsSync(join(root, path))
            ? readFileSync(join(root, path), "utf8")
            : undefined;

    beforeAll(() => {
        for (const kind of ["AUTHOR", "COMMITTER"]) {
            process.env[`GIT_${kind}_NAME`] = "test";
            process.env[`GIT_${kind}_EMAIL`] = "test@example.org";
        }
        process.env.GIT_CONFIG_NOSYSTEM = "1";
    });

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "fixes-"));
        git("init", "-q", "-b", "main");
        commit(
            "feat: start",
            {
                "packages/a/src/a.ts": "export const a = 1;\n",
                "packages/a/tests/unit/a.test.ts": "// a\n",
            },
            "2026-11-01T10:00:00Z",
        );
    });

    afterEach(() => {
        delete process.env.GIT_COMMITTER_DATE;
        delete process.env.GIT_AUTHOR_DATE;
        rmSync(root, { recursive: true, force: true });
    });

    test("tests are the files in tests folders, data included", () => {
        expect(isTest("packages/a/tests/unit/a.test.ts")).toBe(true);
        expect(isTest("packages/lintero/tests/biome.ts")).toBe(true);
        expect(isTest(".github/scripts/tests/fixes.test.ts")).toBe(true);
        expect(isTest("packages/a/src/tests.ts")).toBe(false);
        expect(isTest("README.md")).toBe(false);
    });

    test("the fixes since the date, the oldest first, with their tests apart", () => {
        commit(
            "fix: before the date",
            { "packages/a/src/a.ts": "export const a = 2;\n" },
            "2026-11-27T10:00:00Z",
        );
        const first = commit("fix(a): with a test", {
            "packages/a/src/a.ts": "export const a = 3;\n",
            "packages/a/tests/unit/a.test.ts": "// a, 3\n",
        });
        commit("feat: not a fix", { "packages/a/src/b.ts": "1;\n" });
        commit("docs: fix a typo", { "README.md": "x\n" });
        const second = commit("fix!: without a test", {
            "packages/a/src/a.ts": "export const a = 4;\n",
        });
        expect(fixes(root, "HEAD", "2026-11-28")).toEqual([
            {
                hash: first,
                subject: "fix(a): with a test",
                date: "2026-11-29",
                tests: ["packages/a/tests/unit/a.test.ts"],
                others: ["packages/a/src/a.ts"],
            },
            {
                hash: second,
                subject: "fix!: without a test",
                date: "2026-11-29",
                tests: [],
                others: ["packages/a/src/a.ts"],
            },
        ]);
        expect(fixes(root, `${first}..HEAD`, "2026-11-28")).toHaveLength(1);
    });

    test("the folders of the tests a fix changes", () => {
        const fix: Fix = {
            hash: "",
            subject: "",
            date: "",
            tests: [
                "packages/a/tests/unit/a.test.ts",
                "packages/a/tests/e2e/b.test.ts",
                "shared/s/tests/unit/s.test.ts",
                ".github/scripts/tests/fixes.test.ts",
                "tests/root.test.ts",
            ],
            others: [],
        };
        expect(folders(fix)).toEqual([
            "packages/a",
            "shared/s",
            ".github/scripts",
            ".",
        ]);
    });

    test("a fix without a test, or with nothing but tests, fails the rule", () => {
        commit("fix: no test", { "packages/a/src/a.ts": "2;\n" });
        commit("fix: only a test", {
            "packages/a/tests/unit/a.test.ts": "// more\n",
        });
        const [none, only] = fixes(root, "HEAD", "2026-11-28") as [Fix, Fix];
        const run = () => false;
        expect(check(root, none, run).problem).toBe("it changes no test");
        expect(check(root, only, run).problem).toBe(
            "it changes only tests, there is nothing to undo",
        );
    });

    test("the tests run with the fix undone and kept, and HEAD comes back", () => {
        commit("fix: a is 2, in a new file too", {
            "packages/a/src/a.ts": "export const a = 2;\n",
            "packages/a/src/new.ts": "export const b = 1;\n",
            "packages/a/tests/unit/a.test.ts": "// expects 2\n",
        });
        commit("feat: later", { "packages/a/src/later.ts": "1;\n" });
        const head = git("rev-parse", "HEAD");
        const [fix] = fixes(root, "HEAD", "2026-11-28") as [Fix];
        const seen: Record<string, string | undefined> = {};
        const checked = check(root, fix, (dirs) => {
            expect(dirs).toEqual(["packages/a"]);
            seen.source = read("packages/a/src/a.ts");
            seen.added = read("packages/a/src/new.ts");
            seen.test = read("packages/a/tests/unit/a.test.ts");
            seen.later = read("packages/a/src/later.ts");
            return false;
        });
        // without the fix, with its test, at the commit of the fix
        expect(seen).toEqual({
            source: "export const a = 1;\n",
            added: undefined,
            test: "// expects 2\n",
            later: undefined,
        });
        expect(checked.problem).toBeUndefined();
        expect(git("rev-parse", "HEAD")).toBe(head);
        expect(git("status", "--porcelain")).toBe("");
        expect(read("packages/a/src/a.ts")).toBe("export const a = 2;\n");
    });

    test("tests that pass without the fix fail the rule", () => {
        commit("fix: a is 2", {
            "packages/a/src/a.ts": "export const a = 2;\n",
            "packages/a/tests/unit/a.test.ts": "// passes anyway\n",
        });
        const [fix] = fixes(root, "HEAD", "2026-11-28") as [Fix];
        expect(check(root, fix, () => true).problem).toBe(
            "its tests pass without it, so none of them fails before it",
        );
    });
});
