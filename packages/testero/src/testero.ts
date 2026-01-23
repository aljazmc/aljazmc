import { join } from "node:path";
import type Config from "@aljazmc/config";
import { Includes } from "@aljazmc/config";
import Collector from "./collector.js";
import Expect from "./expect/expect.js";
import Globals from "./globals.js";
import Mocks from "./mock.js";
import Reporter, { type FileResult } from "./reporter.js";
import type { Rules } from "./rules.js";
import Runner, { type Settings } from "./runner.js";
import Transformer from "./transformer.js";

/** The rules, with what the command line adds to them. */
export interface Options extends Rules {
    /** Runs only test files whose path matches one of these regular expressions. */
    patterns: string[];
    /** Runs only tests whose full name matches. */
    namePattern?: RegExp | undefined;
}

/** Finds test files, then compiles, runs and reports them one after another. */
export default class Testero {
    readonly #config: Config<Rules>;
    readonly #options: Options;
    readonly #reporter: Reporter;
    /** Errors thrown outside of tests, like from a forgotten timer. */
    #stray: unknown[] = [];

    constructor(
        config: Config<Rules>,
        options: Options,
        reporter = new Reporter(config.root, { verbose: options.verbose }),
    ) {
        this.#config = config;
        this.#options = options;
        this.#reporter = reporter;
    }

    /** The test files to run, relative to the root. */
    files(): string[] {
        const includes = new Includes(this.#options.testMatch);
        const patterns = this.#options.patterns.map(
            (pattern) => new RegExp(pattern),
        );
        return [...this.#config.files()]
            .filter(
                (file) =>
                    includes.matches(file) &&
                    (patterns.length === 0 ||
                        patterns.some((pattern) => pattern.test(file))),
            )
            .sort();
    }

    /** Runs every test file, returns whether all of them passed. */
    async run(): Promise<boolean> {
        const start = performance.now();
        const files = this.files();
        if (files.length === 0) {
            this.#reporter.none(this.#options.patterns);
            return this.#options.passWithNoTests;
        }

        process.setSourceMapsEnabled(true);
        const stray = (error: unknown) => this.#stray.push(error);
        process.on("uncaughtException", stray);
        process.on("unhandledRejection", stray);

        const transformer = new Transformer();
        const results: FileResult[] = [];
        try {
            for (const file of files) {
                const result = await this.#file(file, transformer);
                results.push(result);
                this.#reporter.file(result);
                if (this.#options.bail && Reporter.failed(result)) break;
            }
        } finally {
            transformer.dispose();
            process.off("uncaughtException", stray);
            process.off("unhandledRejection", stray);
        }

        this.#reporter.summary(results, performance.now() - start);
        return !results.some(Reporter.failed);
    }

    async #file(file: string, transformer: Transformer): Promise<FileResult> {
        const start = performance.now();
        const finish = (results: FileResult["results"], errors: unknown[]) => {
            errors.push(...this.#stray.splice(0));
            // spies on shared objects, like console, must not outlive their file
            Mocks.restoreAll();
            Mocks.forget();
            return {
                file,
                results,
                errors,
                duration: performance.now() - start,
            };
        };

        const collector = new Collector();
        const expect = new Expect();
        const settings: Settings = {
            timeout: this.#options.testTimeout,
            namePattern: this.#options.namePattern,
            beforeTest: () => {
                expect.reset();
                if (this.#options.restoreMocks) Mocks.restoreAll();
                else if (this.#options.resetMocks) Mocks.resetAll();
                else if (this.#options.clearMocks) Mocks.clearAll();
            },
            afterTest: () => expect.verify(),
        };
        Globals.install(collector, expect, settings);

        try {
            await import(
                await transformer.compile(join(this.#config.root, file))
            );
        } catch (error) {
            return finish([], [error]);
        } finally {
            collector.close();
        }

        if ([...collector.root.tests()].length === 0)
            return finish(
                [],
                [new Error("Your test suite must contain at least one test.")],
            );

        const { results, errors } = await new Runner(settings).run(
            collector.root,
        );
        return finish(results, errors);
    }
}
