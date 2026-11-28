/**
 * Checks that every fix since `since` comes with a test that failed before
 * it: the commit changes a test, and its tests fail when the rest of the
 * commit is undone. CI runs it on the commits of a push or a pull request,
 * and on every fix since the date every Monday.
 *
 *     node .github/scripts/fixes.ts [<range> [<since>]]   # default: every fix since the date
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

/** Fixes committed from this day on need a test that failed before them. */
export const since = "2026-11-28";

/** A fix commit, and what it changed. */
export interface Fix {
    hash: string;
    subject: string;
    date: string;
    tests: string[];
    others: string[];
}

/** What checking a fix found. */
export interface Checked {
    fix: Fix;
    /** Why it fails the rule, undefined when its tests failed before it. */
    problem: string | undefined;
}

const git = (cwd: string, args: string[]) =>
    execFileSync("git", args, { cwd, encoding: "utf8" }).trimEnd();

/** Whether a path is a test, or data that only tests read. */
export const isTest = (path: string) => /(^|\/)tests\//.test(path);

/** The fix commits of a range, from a day on, the oldest first, without merges. */
export function fixes(cwd: string, range: string, from = since): Fix[] {
    const log = git(cwd, [
        "log",
        "--no-merges",
        "--reverse",
        "--format=%H%x00%cs%x00%s",
        range,
    ]);
    return log
        .split("\n")
        .filter(Boolean)
        .map((line) => line.split("\x00") as [string, string, string])
        .filter(
            ([, date, subject]) =>
                date >= from && /^fix(\([^)]*\))?!?:/.test(subject),
        )
        .map(([hash, date, subject]) => {
            const files = git(cwd, [
                "diff-tree",
                "--no-commit-id",
                "--name-only",
                "-r",
                "--root",
                hash,
            ])
                .split("\n")
                .filter(Boolean);
            return {
                hash,
                subject,
                date,
                tests: files.filter(isTest),
                others: files.filter((path) => !isTest(path)),
            };
        });
}

/** The folders whose tests a fix changed, like `packages/lintero`. */
export function folders(fix: Fix): string[] {
    return [
        ...new Set(
            fix.tests.map((path) => path.slice(0, path.search(/\/?tests\//))),
        ),
    ].map((folder) => folder || ".");
}

/**
 * Checks a fix: it changes a test, and with the rest of it undone, the
 * tests of the folders it changed fail. `run` runs those tests and returns
 * whether they passed. The checkout is left at the commit it was at.
 */
export function check(
    cwd: string,
    fix: Fix,
    run: (folders: string[]) => boolean,
): Checked {
    if (fix.tests.length === 0) return { fix, problem: "it changes no test" };
    if (fix.others.length === 0)
        return {
            fix,
            problem: "it changes only tests, there is nothing to undo",
        };
    const head = git(cwd, ["rev-parse", "HEAD"]);
    try {
        git(cwd, ["checkout", "-q", "--detach", fix.hash]);
        // the fix undone, its tests kept
        for (const path of fix.others) {
            const before = spawnSync(
                "git",
                ["cat-file", "-e", `${fix.hash}^:${path}`],
                { cwd },
            );
            if (before.status === 0)
                git(cwd, ["checkout", "-q", `${fix.hash}^`, "--", path]);
            else if (existsSync(join(cwd, path))) rmSync(join(cwd, path));
        }
        const passed = run(folders(fix));
        return {
            fix,
            problem: passed
                ? "its tests pass without it, so none of them fails before it"
                : undefined,
        };
    } finally {
        git(cwd, ["checkout", "-q", "-f", head]);
    }
}

if (import.meta.main) {
    const cwd = process.cwd();
    const range = process.argv[2] ?? "HEAD";
    const found = fixes(cwd, range, process.argv[3] ?? since);
    const runner = join(cwd, "packages/testero/bin/main.js");
    const results = found.map((fix) =>
        check(cwd, fix, (dirs) => {
            // the command lines the end-to-end tests run, built without the fix
            for (const name of ["formatero", "lintero", "monorepo"])
                execFileSync("yarn", [`b:${name}`], { cwd, stdio: "ignore" });
            console.log(
                `::group::${fix.hash.slice(0, 7)} ${fix.subject}, without the fix`,
            );
            const tests = spawnSync(process.execPath, [runner, ...dirs], {
                cwd,
                stdio: "inherit",
            });
            console.log("::endgroup::");
            return tests.status === 0;
        }),
    );
    // the command lines as they are at HEAD again
    if (found.length > 0)
        for (const name of ["formatero", "lintero", "monorepo"])
            execFileSync("yarn", [`b:${name}`], { cwd, stdio: "ignore" });
    const lines = [
        `Fixes since ${process.argv[3] ?? since} in ${range}: ${found.length}`,
        ...results.map(
            ({ fix, problem }) =>
                `- ${fix.hash.slice(0, 7)} ${fix.subject}: ${problem ?? `its tests fail without it (${fix.tests.length} test files)`}`,
        ),
    ];
    console.log(lines.join("\n"));
    if (process.env.GITHUB_STEP_SUMMARY)
        execFileSync("sh", ["-c", 'cat >> "$GITHUB_STEP_SUMMARY"'], {
            input: `## A test per fix\n\n${lines.join("\n")}\n`,
        });
    const failed = results.filter(({ problem }) => problem);
    for (const { fix, problem } of failed)
        console.log(
            `::error title=A test per fix::${fix.hash.slice(0, 7)} ${fix.subject}: ${problem}`,
        );
    process.exit(failed.length > 0 ? 1 : 0);
}
