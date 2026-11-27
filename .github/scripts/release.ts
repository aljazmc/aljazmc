/**
 * Plans the releases of the packages of this repository from conventional
 * commits and their tags, for `.github/workflows/release.yml`. Versions live
 * in tags, `@aljazmc/<name>@<version>`, and never in commits: package.json
 * keeps `0.0.0-development`, and CI writes the versions in before it checks
 * and publishes.
 *
 *     node .github/scripts/release.ts plan              # releases due, as JSON
 *     node .github/scripts/release.ts versions <plan>   # writes the versions in
 *     node .github/scripts/release.ts notes <tag>       # the notes of a release
 *     node .github/scripts/release.ts latest            # the last tag of each package
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** A package of the repository, from its package.json. */
export interface Package {
    name: string;
    dir: string;
    /** The packages of the repository it depends on, by name. */
    workspace: string[];
}

/** A commit, short. */
export interface Commit {
    hash: string;
    subject: string;
    body: string;
}

export type Level = "major" | "minor" | "patch";

/** A release that is due. */
export interface Release {
    name: string;
    dir: string;
    /** The last version, undefined for a first release. */
    from: string | undefined;
    to: string;
    level: Level;
    tag: string;
    commits: string[];
}

/** The version of a package, before CI writes one in. */
export const development = "0.0.0-development";
/** The folders of the packages, like the workspaces of the root. */
const folders = ["shared", "packages"];
/** The level of each commit type that releases, the rest release nothing. */
const levels: Record<string, Level> = {
    feat: "minor",
    chore: "patch",
    docs: "patch",
    fix: "patch",
    perf: "patch",
    revert: "patch",
};
const order: Level[] = ["patch", "minor", "major"];

const git = (cwd: string, args: string[]) =>
    execFileSync("git", args, { cwd, encoding: "utf8" }).trimEnd();

/** The packages that are published, a dependency before what uses it. */
export function packages(cwd: string): Package[] {
    const found: Package[] = [];
    for (const folder of folders) {
        if (!existsSync(join(cwd, folder))) continue;
        for (const entry of readdirSync(join(cwd, folder)).sort()) {
            const path = join(cwd, folder, entry, "package.json");
            if (!existsSync(path)) continue;
            const manifest = JSON.parse(readFileSync(path, "utf8"));
            if (manifest.private) continue;
            const dependencies = {
                ...manifest.dependencies,
                ...manifest.peerDependencies,
            } as Record<string, string>;
            found.push({
                name: manifest.name,
                dir: `${folder}/${entry}`,
                workspace: Object.entries(dependencies)
                    .filter(([, range]) => range.startsWith("workspace:"))
                    .map(([name]) => name),
            });
        }
    }
    // dependencies first, so each is published before what uses it
    const sorted: Package[] = [];
    const visit = (pack: Package) => {
        if (sorted.includes(pack)) return;
        for (const name of pack.workspace) {
            const dependency = found.find((other) => other.name === name);
            if (dependency) visit(dependency);
        }
        sorted.push(pack);
    };
    for (const pack of found) visit(pack);
    return sorted;
}

/** Parses `x.y.z`, without a prerelease, undefined otherwise. */
const parse = (version: string) => {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
    return match ? match.slice(1).map(Number) : undefined;
};

const compare = (a: number[], b: number[]) =>
    (a[0] ?? 0) - (b[0] ?? 0) ||
    (a[1] ?? 0) - (b[1] ?? 0) ||
    (a[2] ?? 0) - (b[2] ?? 0);

/** The versions a package was tagged with, the newest first. */
export function versions(cwd: string, name: string): string[] {
    return git(cwd, ["tag", "--list", `${name}@*`])
        .split("\n")
        .map((tag) => tag.slice(name.length + 1))
        .filter((version) => parse(version))
        .sort((a, b) => compare(parse(b) ?? [], parse(a) ?? []));
}

/** Bumps a version; before 1.0.0, a breaking change bumps the minor version. */
export function bump(version: string, level: Level): string {
    const [major = 0, minor = 0, patch = 0] = parse(version) ?? [];
    if (level === "major" && major > 0) return `${major + 1}.0.0`;
    if (level === "patch") return `${major}.${minor}.${patch + 1}`;
    return `${major}.${minor + 1}.0`;
}

/** The highest level the conventional commits call for. */
export function level(commits: Commit[]): Level | undefined {
    let highest = -1;
    for (const { subject, body } of commits) {
        const match = /^(\w+)(?:\([^)]*\))?(!)?:/.exec(subject);
        if (!match) continue;
        const breaking = match[2] === "!" || /^BREAKING[ -]CHANGE:/m.test(body);
        const found = breaking ? "major" : levels[match[1] ?? ""];
        if (found) highest = Math.max(highest, order.indexOf(found));
    }
    return highest < 0 ? undefined : order[highest];
}

/** A package's folder and those of the packages it depends on, all the way down. */
function paths(pack: Package, all: Package[]): string[] {
    const found = new Set([pack.dir]);
    const visit = (names: string[]) => {
        for (const name of names) {
            const dependency = all.find((other) => other.name === name);
            if (!dependency || found.has(dependency.dir)) continue;
            found.add(dependency.dir);
            visit(dependency.workspace);
        }
    };
    visit(pack.workspace);
    return [...found];
}

/**
 * The commits of a range that change some paths, the newest first, without
 * the `version:` commits the release tool before this one made.
 */
export function commits(cwd: string, range: string, of: string[]): Commit[] {
    const output = git(cwd, [
        "log",
        "--format=%x01%h%x00%s%x00%b",
        range,
        "--",
        ...of,
    ]);
    return output
        .split("\x01")
        .filter((record) => record.trim() !== "")
        .map((record) => {
            const [hash = "", subject = "", body = ""] = record
                .replace(/^\n/, "")
                .split("\x00");
            return { hash, subject, body: body.trim() };
        })
        .filter(({ subject }) => !/^version(\([^)]*\))?:/.test(subject));
}

/** The releases due at HEAD, a dependency before what uses it. */
export function plan(cwd: string): Release[] {
    const all = packages(cwd);
    const releases: Release[] = [];
    for (const pack of all) {
        const from = versions(cwd, pack.name)[0];
        const range = from ? `${pack.name}@${from}..HEAD` : "HEAD";
        const changes = commits(cwd, range, paths(pack, all));
        const due = level(changes);
        if (!due) continue;
        const to = from ? bump(from, due) : "0.1.0";
        releases.push({
            name: pack.name,
            dir: pack.dir,
            from,
            to,
            level: due,
            tag: `${pack.name}@${to}`,
            commits: changes.map(({ subject }) => subject),
        });
    }
    return releases;
}

/**
 * Writes the version of each package into its package.json: the one it is
 * released with, or its last one, so `workspace:^` ranges resolve to them.
 */
export function write(cwd: string, releases: Release[]): string[] {
    const written: string[] = [];
    for (const pack of packages(cwd)) {
        const version =
            releases.find((release) => release.name === pack.name)?.to ??
            versions(cwd, pack.name)[0];
        if (!version) continue;
        const path = join(cwd, pack.dir, "package.json");
        const text = readFileSync(path, "utf8");
        const changed = text.replace(
            /^(\s*"version":\s*")[^"]*(")/m,
            `$1${version}$2`,
        );
        if (changed === text && !text.includes(`"version": "${version}"`))
            throw new Error(`${pack.dir}/package.json has no version to set.`);
        writeFileSync(path, changed);
        written.push(`${pack.name} ${version}`);
    }
    return written;
}

const sections: [string, (type: string) => boolean][] = [
    ["Breaking changes", () => false],
    ["Features", (type) => type === "feat"],
    ["Fixes", (type) => type === "fix" || type === "revert"],
    ["Performance", (type) => type === "perf"],
    ["Documentation", (type) => type === "docs"],
    ["Other changes", () => true],
];

/**
 * The notes of a tagged release: what changed since the version before,
 * by kind, with the commits that changed the package or what it bundles.
 */
export function notes(
    cwd: string,
    tag: string,
    { repository = "aljazmc/aljazmc", environment = "" } = {},
): string {
    const at = tag.lastIndexOf("@");
    const name = tag.slice(0, at);
    const version = tag.slice(at + 1);
    const all = packages(cwd);
    const pack = all.find((candidate) => candidate.name === name);
    if (!pack) throw new Error(`No package is named ${name}.`);
    const before = versions(cwd, name).find(
        (other) => compare(parse(other) ?? [], parse(version) ?? []) < 0,
    );
    const range = before ? `${name}@${before}..${tag}` : tag;
    const changes = commits(cwd, range, paths(pack, all));
    const lines = [
        `[${name} ${version} on npm](https://www.npmjs.com/package/${name}/v/${version})` +
            (before
                ? ` · [changes since ${before}](https://github.com/${repository}/compare/${encodeURIComponent(`${name}@${before}`)}...${encodeURIComponent(tag)})`
                : ""),
    ];
    const placed = new Set<Commit>();
    for (const [title, matches] of sections) {
        const of = changes.filter((commit) => {
            if (placed.has(commit)) return false;
            const match = /^(\w+)(?:\([^)]*\))?(!)?:\s*(.*)$/.exec(
                commit.subject,
            );
            const breaking =
                match?.[2] === "!" || /^BREAKING[ -]CHANGE:/m.test(commit.body);
            return title === "Breaking changes"
                ? breaking
                : matches(match?.[1] ?? "");
        });
        if (of.length === 0) continue;
        lines.push("", `### ${title}`, "");
        for (const commit of of) {
            placed.add(commit);
            const text = commit.subject.replace(/^\w+(?:\([^)]*\))?!?:\s*/, "");
            lines.push(`- ${text} (${commit.hash})`);
        }
    }
    if (changes.length === 0)
        lines.push("", "No changes since the version before.");
    if (environment) lines.push("", environment);
    return `${lines.join("\n")}\n`;
}

/** The last tag of each package that has one. */
export function latest(cwd: string): string[] {
    return packages(cwd).flatMap((pack) => {
        const version = versions(cwd, pack.name)[0];
        return version ? [`${pack.name}@${version}`] : [];
    });
}

if (import.meta.main) {
    const [command, argument] = process.argv.slice(2);
    const cwd = process.cwd();
    if (command === "plan") console.log(JSON.stringify(plan(cwd), null, 4));
    else if (command === "versions" && argument)
        for (const line of write(
            cwd,
            JSON.parse(readFileSync(argument, "utf8")) as Release[],
        ))
            console.log(line);
    else if (command === "notes" && argument)
        process.stdout.write(
            notes(cwd, argument, {
                repository: process.env.GITHUB_REPOSITORY ?? "aljazmc/aljazmc",
                environment: process.env.ENVIRONMENT ?? "",
            }),
        );
    else if (command === "latest")
        for (const tag of latest(cwd)) console.log(tag);
    else {
        console.error(
            "usage: release.ts plan | versions <plan.json> | notes <tag> | latest",
        );
        process.exit(2);
    }
}
