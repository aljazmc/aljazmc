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
  --config [js]                  write the default testero.config.ts, or .js
  -h, --help                     show this help
`;

    readonly patterns: string[] = [];
    readonly rules: Partial<Rules> = {};
    namePattern: RegExp | undefined;
    listTests = false;
    help = false;

    constructor(argv: string[]) {
        for (let index = 0; index < argv.length; index++) {
            const argument = argv[index] as string;
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
                case "--testTimeout":
                    this.rules.testTimeout = Number(value());
                    break;
                case "--bail":
                case "--verbose":
                case "--passWithNoTests":
                    this.rules[
                        name.slice(2) as "bail" | "verbose" | "passWithNoTests"
                    ] = true;
                    break;
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
            }
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
