import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type Config from "@aljazmc/config";
import { Pattern } from "@aljazmc/config";
import type Git from "./git.js";
import type { Level, Rules } from "./rules.js";

/** A package of the repository, from its package.json. */
export interface Package {
    name: string;
    /** undefined without a version field, such packages are not versioned. */
    version: string | undefined;
    /** Its folder relative to the root, `.` for the root. */
    root: string;
    /** Names of other packages of the repository it depends on, through `workspace:`. */
    workspaces: string[];
}

/** A new version of a package, or a version in package.json to tag. */
export interface Release {
    name: string;
    root: string;
    from: string;
    to: string;
    /** undefined when the version in package.json has no tag yet, it is tagged as it is. */
    level: Level | undefined;
    tag: string;
    /** Subjects of the commits that changed the package since its last version. */
    commits: string[];
}

/** A change to make for a release: a package.json to write, or a git command to run. */
export type Step =
    | { type: "file"; file: string; text: string; version: string }
    | { type: "git"; args: string[] };

/** A package that has a version, the ones that are versioned. */
type Versioned = Package & { version: string };

/** A package.json that is not valid JSON. */
interface Broken {
    file: string;
    root: string;
    error: string;
}

const levels: Level[] = ["patch", "minor", "major"];

/** The index of the closing quote of a JSON string that opens at an index. */
function stringEnd(text: string, start: number): number {
    for (let index = start + 1; index < text.length; index++)
        if (text[index] === "\\") index++;
        else if (text[index] === '"') return index;
    return text.length;
}

/**
 * A package.json text with its top-level version set, keeping the rest of
 * it as it is written, nested `"version"` keys included.
 */
export function setVersion(text: string, version: string): string {
    let depth = 0;
    for (let index = 0; index < text.length; index++) {
        const char = text[index];
        if (char === '"') {
            const end = stringEnd(text, index);
            if (depth === 1 && text.slice(index, end + 1) === '"version"') {
                const [, colon = "", value = ""] =
                    /^(\s*:\s*)("(?:[^"\\]|\\.)*")/.exec(text.slice(end + 1)) ??
                    [];
                if (value) {
                    const start = end + 1 + colon.length;
                    return `${text.slice(0, start)}${JSON.stringify(version)}${text.slice(start + value.length)}`;
                }
            }
            index = end;
        } else if (char === "{" || char === "[") depth++;
        else if (char === "}" || char === "]") depth--;
    }
    throw new Error("The package.json has no version to set.");
}

/** Bumps a version, before 1.0.0 breaking changes bump the minor version. */
export function bump(version: string, level: Level): string {
    const [major = 0, minor = 0, patch = 0] = version
        .replace(/[-+].*$/, "")
        .split(".")
        .map(Number);
    if (level === "major" && major > 0) return `${major + 1}.0.0`;
    if (level === "patch") return `${major}.${minor}.${patch + 1}`;
    return `${major}.${minor + 1}.0`;
}

/** Independent versions of the packages of a repository, from conventional commits. */
export default class Versions {
    readonly #git: Git;
    readonly #config: Config<Rules>;
    /** The package.json files the last call of packages could not read. */
    #broken: Broken[] = [];

    constructor(git: Git, config: Config<Rules>) {
        this.#git = git;
        this.#config = config;
    }

    /**
     * Every package.json of the repository that is not ignored. Ones that are
     * not valid JSON, like test fixtures, are left out, an error only when
     * they would be versioned.
     */
    packages(): Package[] {
        const packages: Package[] = [];
        this.#broken = [];
        for (const file of this.#config.files()) {
            if (file !== "package.json" && !file.endsWith("/package.json"))
                continue;
            let manifest: Record<string, unknown> | null;
            try {
                manifest = JSON.parse(
                    readFileSync(join(this.#config.root, file), "utf8"),
                );
            } catch (error) {
                this.#broken.push({
                    file,
                    root: dirname(file),
                    error:
                        error instanceof Error ? error.message : String(error),
                });
                continue;
            }
            if (typeof manifest?.name !== "string") continue;
            const fields = [
                "dependencies",
                "devDependencies",
                "peerDependencies",
                "optionalDependencies",
            ];
            const dependencies: Record<string, unknown> = Object.assign(
                {},
                ...fields.map((field) => manifest?.[field] ?? {}),
            );
            packages.push({
                name: manifest.name,
                version:
                    typeof manifest.version === "string"
                        ? manifest.version
                        : undefined,
                root: dirname(file),
                workspaces: Object.entries(dependencies)
                    .filter(([, range]) =>
                        String(range).startsWith("workspace:"),
                    )
                    .map(([name]) => name),
            });
        }
        return packages;
    }

    /**
     * The packages the `packages` setting versions, the shallowest matches of
     * each root, that have a version.
     */
    versioned(packages = this.packages()): Versioned[] {
        const roots = this.#config.rules.packages;
        const patterns = roots
            .filter((root) => root.replace(/^\.\/?|\/$/g, "") !== "")
            .map((root) => new Pattern(root, "packages"));
        const matched = (root: string) =>
            root !== "." && patterns.some((pattern) => pattern.matches(root));
        const all = [
            ...packages.map((pack) => pack.root),
            ...this.#broken.map((broken) => broken.root),
        ];
        const selected = (root: string) =>
            (root === "."
                ? roots.some((each) => each.replace(/^\.\/?|\/$/g, "") === "")
                : matched(root)) &&
            // packages/a/sub is part of packages/a
            !all.some(
                (other) =>
                    other !== root &&
                    other !== "." &&
                    root.startsWith(`${other}/`) &&
                    matched(other),
            );
        for (const broken of this.#broken)
            if (selected(broken.root))
                throw new Error(`${broken.file}: ${broken.error}`);
        return packages.filter(
            (pack): pack is Versioned =>
                pack.version !== undefined && selected(pack.root),
        );
    }

    /** The tag of a version of a package. */
    tag(pack: Versioned, version: string): string {
        const template =
            pack.root === "."
                ? this.#config.rules.rootTag
                : this.#config.rules.tag;
        return template
            .replaceAll("{name}", pack.name)
            .replaceAll("{version}", version);
    }

    /**
     * The releases the commits since the last versions call for. Tags about to
     * be moved count from where they will be, given as tag names and commits.
     */
    plan(moved: ReadonlyMap<string, string> = new Map()): Release[] {
        const all = this.packages();
        const versioned = this.versioned(all);
        const byName = new Map(all.map((pack) => [pack.name, pack]));
        const releases: Release[] = [];

        for (const pack of versioned) {
            const tag = this.tag(pack, pack.version);
            const at = moved.get(tag) ?? this.#git.commit(`refs/tags/${tag}`);
            const tagged = at !== undefined;
            // a tag left on a commit a rebase replaced would count the
            // rebased commits again, up to and with the one it was on
            if (at !== undefined && !this.#ancestor(at))
                throw new Error(
                    `The tag ${tag} is not in the history of HEAD, a rebase left it behind. Move it first, with monorepo tags --write.`,
                );
            // without a tag, the version counts from the commit that set it,
            // released already or not, like when monorepo is first used
            const base = at ?? this.#versioned(pack);
            const commits = base
                ? this.#commits(base, this.#paths(pack, byName, all))
                : [];
            const level = this.#level(commits);
            if (!level) {
                if (!tagged)
                    releases.push({
                        name: pack.name,
                        root: pack.root,
                        from: pack.version,
                        to: pack.version,
                        level: undefined,
                        tag,
                        commits: [],
                    });
                continue;
            }
            const to = bump(pack.version, level);
            releases.push({
                name: pack.name,
                root: pack.root,
                from: pack.version,
                to,
                level,
                tag: this.tag(pack, to),
                commits: commits.map((commit) => commit.subject),
            });
        }
        return releases;
    }

    /**
     * The steps that write the new versions, each committed and tagged on its
     * own, and with push, that push the branch with the new tags, all or nothing.
     */
    steps(releases: Release[], { push = false } = {}): Step[] {
        for (const release of releases)
            if (this.#git.commit(`refs/tags/${release.tag}`))
                throw new Error(`The tag ${release.tag} exists already.`);
        const steps: Step[] = [];
        for (const release of releases) {
            const message = this.#config.rules.message
                .replaceAll("{name}", release.name)
                .replaceAll("{version}", release.to);
            if (release.level) {
                const file =
                    release.root === "."
                        ? "package.json"
                        : `${release.root}/package.json`;
                const text = readFileSync(
                    join(this.#config.root, file),
                    "utf8",
                );
                // only the version changes, the rest keeps its formatting
                steps.push(
                    {
                        type: "file",
                        file,
                        text: setVersion(text, release.to),
                        version: release.to,
                    },
                    { type: "git", args: ["add", "--", file] },
                    {
                        type: "git",
                        args: ["commit", "-q", "-m", message, "--", file],
                    },
                );
            }
            steps.push({
                type: "git",
                args: ["tag", "-a", release.tag, "-m", message],
            });
        }
        if (push && releases.length > 0) {
            const { remote, branch } = this.#config.rules;
            steps.push({
                type: "git",
                args: [
                    "push",
                    "-q",
                    "--atomic",
                    remote,
                    branch === "HEAD" ? "HEAD" : `HEAD:${branch}`,
                    ...releases.map((release) => `refs/tags/${release.tag}`),
                ],
            });
        }
        return steps;
    }

    /** Runs steps, writing the files and running git. */
    run(steps: Step[]): void {
        for (const step of steps)
            if (step.type === "file")
                writeFileSync(join(this.#config.root, step.file), step.text);
            else this.#git.run(step.args);
    }

    /**
     * Paths whose changes concern a package: its folder and the folders of the
     * packages it depends on through `workspace:`, like bundled shared code.
     * The root package has everything outside of the other packages.
     */
    #paths(
        pack: Package,
        byName: Map<string, Package>,
        packages: Package[],
    ): string[] {
        if (pack.root === ".")
            return [
                ".",
                ...packages
                    .filter((other) => other.root !== ".")
                    .map((other) => `:(exclude)${other.root}`),
            ];
        const roots = new Set<string>();
        const visit = (current: Package) => {
            if (roots.has(current.root)) return;
            roots.add(current.root);
            for (const name of current.workspaces) {
                const dependency = byName.get(name);
                if (dependency && dependency.root !== ".") visit(dependency);
            }
        };
        visit(pack);
        return [...roots];
    }

    /** Whether a commit is in the history of HEAD. */
    #ancestor(commit: string): boolean {
        try {
            this.#git.run(["merge-base", "--is-ancestor", commit, "HEAD"]);
            return true;
        } catch {
            return false;
        }
    }

    /** The last commit that changed the version in the package.json of a package. */
    #versioned(pack: Package): string | undefined {
        const file =
            pack.root === "." ? "package.json" : `${pack.root}/package.json`;
        const hash = this.#git.run([
            "log",
            "-1",
            "--format=%H",
            "-G",
            '"version"[[:space:]]*:',
            "--",
            file,
        ]);
        return hash === "" ? undefined : hash;
    }

    /** Commits since a commit that change some paths, without the version commits themselves. */
    #commits(
        base: string,
        paths: string[],
    ): { subject: string; body: string }[] {
        const output = this.#git.run([
            "log",
            "--format=%s%x00%b%x01",
            `${base}..HEAD`,
            "--",
            ...paths,
        ]);
        const own = new RegExp(
            `^${this.#config.rules.message
                .split(/\{name\}|\{version\}/)
                .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
                .join(".+")}$`,
        );
        return output
            .split("\x01")
            .map((record) => record.replace(/^\n/, ""))
            .filter((record) => record !== "")
            .map((record) => {
                const [subject = "", body = ""] = record.split("\x00");
                return { subject, body };
            })
            .filter(({ subject }) => !own.test(subject));
    }

    /** The highest level the conventional commits call for. */
    #level(commits: { subject: string; body: string }[]): Level | undefined {
        let highest = -1;
        for (const { subject, body } of commits) {
            const match = /^(\w+)(?:\([^)]*\))?(!)?:/.exec(subject);
            if (!match) continue;
            const breaking =
                match[2] === "!" || /^BREAKING[ -]CHANGE:/m.test(body);
            const level = breaking
                ? "major"
                : this.#config.rules.bump[match[1] ?? ""];
            if (level) highest = Math.max(highest, levels.indexOf(level));
        }
        return highest < 0 ? undefined : levels[highest];
    }
}
