import type { Rules } from "./rules.js";
import type { Options } from "./testero.js";

/** Command line arguments, named like Jest's. */
export default class Arguments {
    static readonly usage = `Usage: testero [patterns...] [options]

Runs the test files whose paths match a pattern, every test file without patterns.

Options:
  -t, --testNamePattern <regex>  run only tests whose name matches
  --bail                         stop after the first failing test file
  --verbose                      list every test
  --listTests                    print the test files instead of running them
  --passWithNoTests              succeed when there are no test files
  --testTimeout <ms>             milliseconds a test or hook may take
  --coverage                     report which lines and functions the tests run
  --watch                        rerun the tests of changed files and what imports them
  --watchAll                     rerun every test when a file changes
  --config [js]                  write the default testero.config.ts, or .js
  -h, --help                     show this help
`;

    readonly patterns: string[] = [];
    readonly rules: Partial<Rules> = {};
    namePattern: RegExp | undefined;
    listTests = false;
    help = false;
    /** Reruns the tests of changed files, or all of them, when files change. */
    watch: "related" | "all" | undefined;
    /** The options, without the patterns and the watch ones, for the runs of watch mode. */
    readonly flags: string[] = [];

    constructor(argv: string[]) {
        for (let index = 0; index < argv.length; index++) {
            const argument = argv[index] as string;
            const start = index;
            const [name, inline] = argument.split(/=(.*)/s) as [
                string,
                string?,
            ];
            const value = () => {
                const next = inline ?? argv[++index];
                if (next === undefined)
                    throw new Error(`${name} needs a value.`);
                return next;
            };

            switch (name) {
                case "-t":
                case "--testNamePattern":
                    this.namePattern = new RegExp(value());
                    break;
                case "--testTimeout": {
                    const text = value();
                    const timeout = Number(text);
                    // a timer of 2 ** 31 ms or more fires at once
                    const valid = timeout > 0 && timeout < 2 ** 31;
                    if (text.trim() === "" || !valid)
                        throw new Error(
                            `--testTimeout needs a positive number of milliseconds, not "${text}".`,
                        );
                    this.rules.testTimeout = timeout;
                    break;
                }
                case "--bail":
                case "--verbose":
                case "--passWithNoTests":
                    this.rules[
                        name.slice(2) as "bail" | "verbose" | "passWithNoTests"
                    ] = true;
                    break;
                case "--coverage":
                case "--collectCoverage":
                    this.rules.collectCoverage = true;
                    break;
                case "--watch":
                    this.watch ??= "related";
                    continue;
                case "--watchAll":
                    this.watch = "all";
                    continue;
                case "--listTests":
                    this.listTests = true;
                    break;
                case "-h":
                case "--help":
                    this.help = true;
                    break;
                default:
                    if (name.startsWith("-"))
                        throw new Error(`Unknown option ${name}.`);
                    this.patterns.push(argument);
                    continue;
            }
            this.flags.push(...argv.slice(start, index + 1));
        }
    }

    /** The configured rules, with the ones given on the command line instead. */
    options(rules: Rules): Options {
        return {
            ...rules,
            ...this.rules,
            patterns: this.patterns,
            namePattern: this.namePattern,
        };
    }
}
