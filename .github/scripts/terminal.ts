/**
 * Draws `.github/assets/terminal.svg`, the session at the top of README.md,
 * from a real run of the built lintero and formatero on a small module, so
 * the picture shows what the tools print. It is drawn as formatero formats
 * it, indented by 4 like the rest of the repository. `tests/terminal.test.ts` fails
 * when it is out of date; draw it again with `yarn b:formatero &&
 * yarn b:lintero && node .github/scripts/terminal.ts`.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dirname, "../..");
export const picture = join(root, ".github/assets/terminal.svg");

/** The module of the session: unsorted imports, a debugger, no formatting. */
const module = `import { double } from "./double.ts"
import { add } from "./add.ts"

export function sum(values: number[]) {
  debugger
  return values.map(double).reduce(add, 0)
}
`;

/** What the user types, and the package that runs. */
const commands: [string, "lintero" | "formatero", string[]][] = [
    ["npx lintero", "lintero", []],
    ["npx lintero --write --unsafe", "lintero", ["--write", "--unsafe"]],
    ["npx formatero", "formatero", []],
    ["npx formatero --write", "formatero", ["--write"]],
    ["npx formatero && npx lintero", "formatero", []],
];

/** Runs the session in a folder of its own, returns its lines. */
export function session(): string[] {
    const directory = mkdtempSync(join(tmpdir(), "terminal-"));
    try {
        writeFileSync(join(directory, "sum.ts"), module);
        const lines: string[] = [];
        for (const [typed, name, args] of commands) {
            lines.push(`$ ${typed}`);
            const run = (tool: string, more: string[]) => {
                try {
                    return execFileSync(
                        process.execPath,
                        [join(root, `packages/${tool}/bin/main.js`), ...more],
                        { cwd: directory, encoding: "utf8" },
                    );
                } catch (error) {
                    return (error as { stdout: string }).stdout;
                }
            };
            let output = run(name, args);
            // the last line checks both, as a pre-commit hook would
            if (typed.includes("&&")) output += run("lintero", []);
            lines.push(...output.trimEnd().split("\n").filter(Boolean));
        }
        return lines;
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
}

const xml = (text: string) =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The colour of a line: what was typed, an error, a change, or plain. */
const colour = (line: string) =>
    line.startsWith("$ ")
        ? "#7ee787"
        : line.startsWith("error:")
          ? "#ff7b72"
          : line.startsWith("warn:")
            ? "#e3b341"
            : /^(fixed|formatted|unformatted):/.test(line)
              ? "#79c0ff"
              : "#c9d1d9";

/** The lines as a terminal window, in SVG. */
export function svg(lines: string[]): string {
    const size = 14;
    const height = 20;
    const width = Math.ceil(
        Math.max(...lines.map((line) => line.length)) * size * 0.6 + 48,
    );
    const top = 44;
    const total = top + lines.length * height + 16;
    const text = lines
        .map(
            (line, index) =>
                `        <text x="24" y="${top + index * height}" fill="${colour(line)}">${xml(line)}</text>`,
        )
        .join("\n");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${total}" viewBox="0 0 ${width} ${total}" role="img" aria-label="lintero and formatero in a terminal">
    <title>lintero and formatero checking and fixing a module</title>
    <rect width="${width}" height="${total}" rx="8" fill="#0d1117"/>
    <circle cx="20" cy="16" r="5" fill="#ff5f56"/>
    <circle cx="38" cy="16" r="5" fill="#ffbd2e"/>
    <circle cx="56" cy="16" r="5" fill="#27c93f"/>
    <g font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="${size}" xml:space="preserve">
${text}
    </g>
</svg>
`;
}

if (import.meta.main) {
    writeFileSync(picture, svg(session()));
    console.log(`Drew ${picture}`);
}
