/** Test files to run, or all of them. */
export type Selection = string[] | "all";

/** A run in progress. */
export interface Run {
    /** Settles when the run is over, also when it was stopped. */
    done: Promise<unknown>;
    stop(): void;
}

export interface WatcherOptions {
    /** Reruns every test file on a change, or only the ones it concerns. */
    mode: "all" | "related";
    /** Starts a run of test files, of all of them when undefined. */
    run: (files: string[] | undefined) => Run;
    /** The test files that changed paths, relative to the root, concern. */
    related: (changed: ReadonlySet<string>) => Promise<string[]>;
    /** Calls back with each changed path relative to the root, returns how to stop. */
    subscribe: (listener: (path: string) => void) => () => void;
    /** Whether a change to a path, relative to the root, is left alone. */
    ignores?: (path: string) => boolean;
    /** Keys, like `a` to run all tests, come from it when given. */
    input?: NodeJS.ReadStream | undefined;
    write?: (text: string) => void;
    /** Clears the screen before each run. */
    clear?: boolean;
    /** Milliseconds to wait for more changes, as saving often writes several files. */
    delay?: number;
}

/**
 * Reruns tests when files change. A change during a run stops it, the next
 * run takes its files too.
 */
export default class Watcher {
    readonly #options: WatcherOptions;
    readonly #write: (text: string) => void;
    #current: { selection: Selection; run: Run } | undefined;
    #queued: Selection | undefined;
    #last: Selection = "all";
    #changed = new Set<string>();
    #timer: NodeJS.Timeout | undefined;
    #unsubscribe: (() => void) | undefined;
    #closed = false;
    readonly #keys = (data: Buffer | string) => this.#key(String(data));

    constructor(options: WatcherOptions) {
        this.#options = options;
        this.#write = options.write ?? ((text) => process.stdout.write(text));
    }

    /** Runs all tests, then watches. */
    start(): void {
        this.#unsubscribe = this.#options.subscribe((path) =>
            this.#change(path),
        );
        const input = this.#options.input;
        if (input) {
            input.setRawMode?.(true);
            input.on("data", this.#keys);
            input.resume();
        }
        this.#queue("all");
    }

    /** Stops watching and the run in progress. */
    close(): void {
        this.#closed = true;
        clearTimeout(this.#timer);
        this.#unsubscribe?.();
        this.#current?.run.stop();
        const input = this.#options.input;
        if (input) {
            input.off("data", this.#keys);
            input.setRawMode?.(false);
            input.pause();
        }
    }

    #key(key: string): void {
        // q, or Ctrl+C and Ctrl+D, as raw mode stops them from signaling
        if (key === "q" || key === "\u0003" || key === "\u0004") this.close();
        else if (key === "a") this.#queue("all");
        else if (key === "\r" || key === "\n") this.#queue(this.#last);
    }

    #change(path: string): void {
        if (this.#closed || this.#options.ignores?.(path)) return;
        this.#changed.add(path);
        clearTimeout(this.#timer);
        this.#timer = setTimeout(
            () => void this.#flush(),
            this.#options.delay ?? 100,
        );
    }

    async #flush(): Promise<void> {
        const changed = this.#changed;
        this.#changed = new Set();
        if (this.#options.mode === "all") return this.#queue("all");
        try {
            const files = await this.#options.related(changed);
            if (files.length > 0) this.#queue(files);
        } catch (error) {
            this.#write(
                `${error instanceof Error ? error.message : String(error)}\n`,
            );
        }
    }

    /** Runs a selection, after stopping the run in progress, whose files run again too. */
    #queue(selection: Selection): void {
        if (this.#closed) return;
        this.#queued = Watcher.merge(this.#queued, selection);
        if (this.#current) {
            this.#queued = Watcher.merge(this.#queued, this.#current.selection);
            this.#current.run.stop();
        } else this.#next();
    }

    #next(): void {
        const selection = this.#queued;
        if (selection === undefined || this.#closed) return;
        this.#queued = undefined;
        this.#last = selection;
        if (this.#options.clear) this.#write("\x1b[2J\x1b[3J\x1b[H");

        const run = this.#options.run(
            selection === "all" ? undefined : selection,
        );
        this.#current = { selection, run };
        void run.done.then(() => {
            this.#current = undefined;
            if (this.#queued !== undefined) this.#next();
            else if (!this.#closed) this.#usage();
        });
    }

    #usage(): void {
        this.#write(
            this.#options.input
                ? [
                      "",
                      "Watch Usage",
                      " › Press a to run all tests.",
                      " › Press Enter to run the last tests again.",
                      " › Press q to quit watch mode.",
                      "",
                  ].join("\n")
                : "\nWatching for changes, Ctrl+C quits.\n",
        );
    }

    /** Two selections in one, all when either is. */
    static merge(a: Selection | undefined, b: Selection): Selection {
        if (a === undefined) return b;
        if (a === "all" || b === "all") return "all";
        return [...new Set([...a, ...b])].sort();
    }
}

/**
 * Which test files changed paths concern: changed ones, and the ones bundled
 * from a changed file. The files of each test are remembered until one of
 * them changes; a test file that does not compile always counts.
 */
export class Dependencies {
    readonly #list: (file: string) => Promise<string[]>;
    readonly #inputs = new Map<string, Set<string>>();

    /** `list` gives the files a test file is bundled from, all relative to the root. */
    constructor(list: (file: string) => Promise<string[]>) {
        this.#list = list;
    }

    async related(
        tests: string[],
        changed: ReadonlySet<string>,
    ): Promise<string[]> {
        const related: string[] = [];
        for (const test of tests) {
            const known = this.#inputs.get(test);
            const touched = (inputs: Set<string> | undefined) =>
                inputs !== undefined &&
                [...inputs].some((input) => changed.has(input));

            let inputs = known;
            if (!known || changed.has(test) || touched(known))
                try {
                    inputs = new Set(await this.#list(test));
                    this.#inputs.set(test, inputs);
                } catch {
                    this.#inputs.delete(test);
                    related.push(test);
                    continue;
                }
            if (changed.has(test) || touched(known) || touched(inputs))
                related.push(test);
        }
        return related;
    }
}
