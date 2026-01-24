import { execFileSync } from "node:child_process";

/** Who made a tag or a commit, and when. */
export interface Signature {
    name: string;
    email: string;
    date: string;
}

/** A tag and the commit it points to, with its message when annotated. */
export interface Tag {
    name: string;
    commit: string;
    annotation?: { message: string; tagger: Signature; signed: boolean };
}

/** Runs git in a repository. */
export default class Git {
    readonly #directory: string;

    constructor(directory: string) {
        this.#directory = directory;
    }

    /** The output of a git command, it throws when git fails. */
    run(
        args: string[],
        options: { input?: string; env?: Record<string, string> } = {},
    ): string {
        return execFileSync("git", args, {
            cwd: this.#directory,
            encoding: "utf8",
            input: options.input ?? "",
            env: { ...process.env, ...options.env },
            maxBuffer: 1 << 30,
            stdio: ["pipe", "pipe", "pipe"],
        }).trimEnd();
    }

    /** The full hash of a commit, undefined when it does not exist here. */
    commit(revision: string): string | undefined {
        try {
            return this.run([
                "rev-parse",
                "--verify",
                "--quiet",
                `${revision}^{commit}`,
            ]);
        } catch {
            return undefined;
        }
    }

    /** The local tags, annotated ones with their message and tagger. */
    tags(): Tag[] {
        const fields = [
            "%(refname:strip=2)",
            "%(objecttype)",
            "%(objectname)",
            "%(*objectname)",
            "%(taggername)",
            "%(taggeremail:trim)",
            "%(taggerdate:iso-strict)",
            "%(contents)",
            "%(contents:signature)",
        ];
        const output = this.run([
            "for-each-ref",
            "refs/tags",
            `--format=${fields.join("%00")}%01`,
        ]);
        return output
            .split("\x01")
            .map((record) => record.replace(/^\n/, ""))
            .filter((record) => record !== "")
            .map((record) => {
                const [name = "", type, object = "", peeled = "", ...rest] =
                    record.split("\x00");
                if (type !== "tag") return { name, commit: object };
                const [
                    tagger = "",
                    email = "",
                    date = "",
                    contents = "",
                    signature = "",
                ] = rest;
                return {
                    name,
                    commit: peeled,
                    annotation: {
                        message: contents.slice(
                            0,
                            contents.length - signature.length,
                        ),
                        tagger: { name: tagger, email, date },
                        signed: signature !== "",
                    },
                };
            });
    }

    /** The tags of a remote and the commits they point to. */
    remoteTags(remote: string): Map<string, string> {
        const tags = new Map<string, string>();
        const output = this.run(["ls-remote", "--tags", remote]);
        for (const line of output.split("\n")) {
            const match = /^([0-9a-f]+)\trefs\/tags\/(.+?)(\^\{\})?$/.exec(
                line,
            );
            if (!match) continue;
            const [, hash, name, peeled] = match as unknown as [
                string,
                string,
                string,
                string?,
            ];
            // annotated tags are listed twice, the peeled line names the commit
            if (peeled || !tags.has(name)) tags.set(name, hash);
        }
        return tags;
    }
}
