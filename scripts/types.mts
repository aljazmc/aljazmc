/**
 * Copies the declarations of the private shared packages, which esbuild bundles
 * into the code, to `bin/types/shared` of each named package and imports them
 * from there, so the published declarations need no `@aljazmc/*` package.
 */
import { cpSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const root = join(import.meta.dirname, "..");

for (const name of process.argv.slice(2)) {
    const types = join(root, "packages", name, "bin", "types");
    for (const file of readdirSync(types, {
        recursive: true,
        encoding: "utf8",
    })) {
        if (!file.endsWith(".d.ts") || file.startsWith("shared")) continue;
        const path = join(types, file);
        const text = readFileSync(path, "utf8").replace(
            /"@aljazmc\/(config|syntax)"/g,
            (_, shared: string) => {
                cpSync(
                    join(root, "shared", shared, "bin", "types"),
                    join(types, "shared", shared),
                    { recursive: true },
                );
                const index = relative(
                    dirname(path),
                    join(types, "shared", shared, "index.js"),
                ).replaceAll("\\", "/");
                return `"${index.startsWith(".") ? index : `./${index}`}"`;
            },
        );
        writeFileSync(path, text);
    }
}
