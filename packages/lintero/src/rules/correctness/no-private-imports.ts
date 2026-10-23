import {
    type Comment,
    language as languageOf,
    type Node,
    parse,
} from "@aljazmc/syntax";
import Imports from "../../analysis/imports.js";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

type Visibility = "public" | "package" | "private";

const extensions = [
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".mjs",
    ".cjs",
    ".mts",
    ".cts",
];

/** Joins and normalizes path segments, like `sub/../foo.js` to `foo.js`. */
const normalize = (segments: string[]): string[] => {
    const result: string[] = [];
    for (const segment of segments) {
        if (segment === "..") result.pop();
        else if (segment !== "." && segment !== "") result.push(segment);
    }
    return result;
};

/** Whether a file is an index of its folder, `index.js` or Deno's `mod.ts`. */
const isIndex = (file: string): boolean =>
    /^(index|mod)\.[cm]?[jt]sx?$/.test(file.split("/").at(-1) ?? "");

/** The visibility a JSDoc comment gives, like `@private` or `@access package`. */
const visibility = (comment: Comment | undefined): Visibility | undefined => {
    const found =
        comment &&
        /@(?:access\s+)?(public|package|private)\b/.exec(comment.value);
    return found?.[1] as Visibility | undefined;
};

/** Exported names of a module, with the visibility of each. */
const exported = (
    text: string,
    file: string,
    fallback: Visibility,
): Map<string, Visibility> => {
    const result = new Map<string, Visibility>();
    const language = languageOf(file);
    if (!language) return result;
    let program: Node;
    let comments: Comment[];
    try {
        ({ program, comments } = parse(text, language));
    } catch {
        return result;
    }
    if (program.type !== "Program") return result;
    // the JSDoc comment right before a statement
    const doc = (statement: Node) =>
        comments.findLast(
            (comment) =>
                comment.end <= statement.start &&
                comment.value.startsWith("/**") &&
                text.slice(comment.end, statement.start).trim() === "",
        );
    const declared = new Map<string, Node>();
    for (const statement of program.body) {
        const declaration =
            statement.type === "ExportNamedDeclaration" && statement.declaration
                ? statement.declaration
                : statement;
        for (const name of names(declaration)) declared.set(name, statement);
    }
    for (const statement of program.body) {
        if (statement.type !== "ExportNamedDeclaration" || statement.source)
            continue;
        const own = visibility(doc(statement));
        if (statement.declaration)
            for (const name of names(statement.declaration))
                result.set(name, own ?? fallback);
        for (const specifier of statement.specifiers) {
            if (specifier.type !== "ExportSpecifier") continue;
            const local = Nodes.key(specifier.local) ?? "";
            const source = declared.get(local);
            result.set(
                Nodes.key(specifier.exported) ?? local,
                own ??
                    (source ? visibility(doc(source)) : undefined) ??
                    fallback,
            );
        }
    }
    return result;
};

/** Names a declaration binds, like `a` of `const a = 1` or `f` of `function f() {}`. */
const names = (declaration: Node): string[] => {
    if (declaration.type === "VariableDeclaration")
        return declaration.declarations.flatMap((declarator) =>
            declarator.type === "VariableDeclarator" &&
            declarator.id.type === "Identifier"
                ? [declarator.id.name]
                : [],
        );
    if (
        "id" in declaration &&
        declaration.id &&
        typeof declaration.id === "object" &&
        "name" in declaration.id
    )
        return [String(declaration.id.name)];
    return [];
};

export default rule<{ defaultVisibility?: Visibility }>({
    name: "noPrivateImports",
    group: "correctness",
    severity: "warn",
    recommended: false,
    fix: "none",
    languages: ["js"],
    domains: { project: "recommended" },
    options: { defaultVisibility: "public" },
    create: (context) => {
        const read = context.project.read;
        if (!read) return {};
        const importer = Imports.segments(context.file);
        const folder = importer.slice(0, -1);

        /** The file an import resolves to, trying extensions and index files. */
        const resolve = (source: string): string | undefined => {
            const base = normalize([...folder, ...source.split("/")]).join("/");
            const candidates = [
                base,
                ...extensions.map((extension) => base + extension),
                ...(base.endsWith(".js")
                    ? [".ts", ".tsx"].map(
                          (extension) => base.slice(0, -3) + extension,
                      )
                    : []),
                ...extensions.map((extension) => `${base}/index${extension}`),
            ];
            return candidates.find(
                (candidate) =>
                    extensions.some((extension) =>
                        candidate.endsWith(extension),
                    ) && read(candidate) !== undefined,
            );
        };

        /** Whether the importing file is inside a folder. */
        const within = (scope: string[]) =>
            scope.every((segment, index) => folder[index] === segment) &&
            folder.length >= scope.length;

        return {
            ImportDeclaration(node) {
                const source = Nodes.string(node.source);
                if (!source?.startsWith(".")) return;
                const target = resolve(source);
                const text = target && read(target);
                if (
                    !target ||
                    text === undefined ||
                    target === importer.join("/")
                )
                    return;
                const symbols = exported(
                    text,
                    target,
                    context.options.defaultVisibility ?? "public",
                );
                // a file is a module of its own, an index file stands for its folder
                const segments = target.split("/");
                const module = isIndex(target)
                    ? segments.slice(0, -1)
                    : segments;
                for (const specifier of node.specifiers) {
                    if (specifier.type !== "ImportSpecifier") continue;
                    const name = Nodes.key(specifier.imported) ?? "";
                    const level = symbols.get(name);
                    const allowed =
                        level === "private"
                            ? isIndex(target) && within(module)
                            : level === "package"
                              ? within(module.slice(0, -1))
                              : true;
                    if (!allowed)
                        context.report(
                            specifier.imported,
                            `You may not import a symbol with ${level} visibility from here.`,
                        );
                }
            },
        };
    },
});
