import type { Comment, Node } from "@aljazmc/syntax";

export interface OrganizeOptions {
    /** Sorts bare imports, like `import "a"`, with the others instead of keeping them in place. */
    sortBareImports: boolean;
    /** How names in braces and attributes are compared. */
    identifierOrder: "natural" | "lexicographic";
}

/** The change that organizes the imports and exports of a module. */
export interface Organized {
    start: number;
    end: number;
    text: string;
    /** Where the first statement to change starts. */
    report: number;
    /** Whether that statement is an export. */
    exports: boolean;
}

/**
 * A statement of the module: its leading trivia, the line breaks and
 * comments before it, and its text, with the comments after it on its line.
 */
interface Slot {
    node: Node;
    trivia: string;
    text: string;
    /** `import`, `export`, or the type of another statement. */
    kind: string;
    /** The import or export it is, when it can be in a chunk. */
    entry?: Entry;
}

/** A name in braces, with the comments that go with it. */
interface Unit {
    key: string;
    text: string;
    lead: Comment[];
    trail: Comment[];
}

/** An import or export, as it is sorted and merged. */
interface Entry {
    slot: number;
    exports: boolean;
    /** Whether it has a source, `export { a }` does not. */
    sourced: boolean;
    type: boolean;
    kind: number;
    source: string;
    sourceRaw: string;
    attributes: Node[];
    defaultName?: string;
    namespace?: string;
    named?: Unit[];
    /** The text of its attributes, like ` with { a: "b" }`. */
    attributesText: string;
    semicolon: boolean;
    /** Whether it can be printed again, it has no comments but in its braces. */
    rewritable: boolean;
    /** The comments after it on its line. */
    trail: string;
    statement: string;
}

/** The kinds of statements from the same source, in their order. */
const Kind = {
    Bare: 1,
    NamespaceType: 2,
    DefaultType: 3,
    NamedType: 4,
    Namespace: 5,
    DefaultNamespace: 6,
    Default: 7,
    DefaultNamed: 8,
    Named: 9,
} as const;

/** The kinds of sources, in their order. */
const SourceKind = {
    Unknown: 0,
    Url: 1,
    ProtocolPackage: 2,
    Package: 3,
    Alias: 4,
    Path: 5,
} as const;

/** Weights of bytes from collation tables of ASCII characters, other bytes weigh themselves. */
function weights(table: string): Uint8Array {
    const result = new Uint8Array(256);
    for (let index = 0; index < 256; index++) result[index] = index;
    const chars = [...Array.from({ length: 32 }, (_, index) => index), 0x7f];
    // control characters first, as in Biome's tables
    const controls = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14,
        0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x7f,
        9, 10, 0x0b, 0x0c, 13,
    ];
    const order = [
        ...controls,
        ...[...table].map((char) => char.charCodeAt(0)),
    ];
    if (order.length !== 128 || chars.some((char) => !order.includes(char)))
        throw new Error("Invalid collation table.");
    for (const [index, byte] of order.entries()) result[byte] = index;
    return result;
}

const letters = "AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz";
/** Biome's natural order of names, from the CLDR root collation. */
const names = weights(
    ` _-,;:!?.'"()[]{}@*/\\&#%\`^+<=>|~$0123456789${letters}`,
);
/** Biome's natural order of import sources, separators of paths first. */
const sources = weights(
    `/\\?#=&;,@:. _-+*!%$()[]{}<>|^~'"\`0123456789${letters}`,
);

const encoder = new TextEncoder();
const isDigit = (byte: number | undefined) =>
    byte !== undefined && byte >= 0x30 && byte <= 0x39;

/** Compares strings like Biome's collator: by weights, numbers by value. */
function collate(table: Uint8Array, s1: string, s2: string): number {
    const a = encoder.encode(s1);
    const b = encoder.encode(s2);
    let i = 0;
    let j = 0;
    let prev: number | undefined;
    for (;;) {
        let c1 = a[i++];
        let c2 = b[j++];
        if (c1 === undefined && c2 === undefined) return 0;
        if (c1 === undefined) return -1;
        if (c2 === undefined) return 1;
        if (c1 === c2) {
            prev = c1;
            continue;
        }
        let numbers = 0;
        for (;;) {
            const d1 = isDigit(c1);
            const d2 = isDigit(c2);
            if (!d1 && !d2) {
                if (numbers !== 0) return numbers;
                break;
            }
            if (!d1) {
                if (isDigit(prev)) return -1;
                break;
            }
            if (!d2) {
                if (isDigit(prev)) return 1;
                break;
            }
            if (numbers === 0) numbers = Math.sign((c1 as number) - c2);
            const n1 = a[i++];
            const n2 = b[j++];
            if (n1 === undefined && n2 === undefined) return numbers;
            if (n1 === undefined) return isDigit(n2) ? -1 : numbers || -1;
            if (n2 === undefined) return isDigit(n1) ? 1 : numbers || 1;
            prev = c1;
            c1 = n1;
            c2 = n2;
        }
        const order = Math.sign(
            (table[c1 as number] as number) - (table[c2 as number] as number),
        );
        if (order !== 0) return order;
        prev = c1;
    }
}

function sourceKind(source: string): number {
    const first = source[0];
    if (first === "@") {
        const second = source[1];
        if (second === undefined || second === "/") return SourceKind.Alias;
        return /[a-z0-9-]/.test(second)
            ? SourceKind.Package
            : SourceKind.Unknown;
    }
    if (first === "#" || first === "~" || first === "$" || first === "%")
        return SourceKind.Alias;
    if (first === "/") return SourceKind.Path;
    if (first === ".") {
        if (source[1] === ".")
            return source[2] === undefined || source[2] === "/"
                ? SourceKind.Path
                : SourceKind.Unknown;
        return source[1] === undefined || source[1] === "/"
            ? SourceKind.Path
            : SourceKind.Unknown;
    }
    if (first !== undefined && /[a-z0-9_-]/.test(first)) {
        for (let index = 1; ; index++) {
            const char = source[index];
            if (char === undefined || char === "/") return SourceKind.Package;
            if (/[a-z0-9_.-]/.test(char)) continue;
            if (char !== ":") return SourceKind.Unknown;
            const next = source[index + 1];
            if (next === "/") return SourceKind.Url;
            return next !== undefined && /[@a-z0-9_-]/.test(next)
                ? SourceKind.ProtocolPackage
                : SourceKind.Unknown;
        }
    }
    return SourceKind.Unknown;
}

type Component =
    | { type: "root" }
    | { type: "parent"; count: number }
    | { type: "current" }
    | { type: "normal"; name: string };

/** The components of a path like Rust's, with runs of `..` as one. */
function components(path: string): Component[] {
    const raw: Component[] = [];
    if (path.startsWith("/")) raw.push({ type: "root" });
    const parts = path.split("/").filter((part) => part !== "");
    for (const [index, part] of parts.entries()) {
        if (part === "..") raw.push({ type: "parent", count: 1 });
        // `.` counts only first, `./a/./b` is `./a/b`
        else if (part === ".") {
            if (index === 0 && !path.startsWith("/"))
                raw.push({ type: "current" });
        } else raw.push({ type: "normal", name: part });
    }
    const result: Component[] = [];
    for (const component of raw) {
        const last = result.at(-1);
        if (component.type === "parent" && last?.type === "parent")
            last.count++;
        else if (component.type === "parent" && last?.type === "current")
            result[result.length - 1] = { type: "parent", count: 1 };
        else result.push({ ...component });
    }
    return result;
}

const componentRank = { root: 0, parent: 1, current: 2, normal: 3 };

function comparePaths(p1: string, p2: string): number {
    const a = components(p1);
    const b = components(p2);
    for (let index = 0; ; index++) {
        const c1 = a[index];
        const c2 = b[index];
        if (!c1 && !c2) return 0;
        if (!c1) return -1;
        if (!c2) return 1;
        const rank = componentRank[c1.type] - componentRank[c2.type];
        if (rank !== 0) return Math.sign(rank);
        if (c1.type === "parent" && c2.type === "parent") {
            if (c1.count !== c2.count) return c1.count > c2.count ? -1 : 1;
        } else if (c1.type === "normal" && c2.type === "normal") {
            const order = collate(sources, c1.name, c2.name);
            if (order !== 0) return order;
        }
    }
}

function compareSources(s1: string, s2: string): number {
    const k1 = sourceKind(s1);
    const k2 = sourceKind(s2);
    if (k1 !== k2) return k1 - k2;
    if (k1 === SourceKind.Path) {
        const order = comparePaths(s1, s2);
        if (order !== 0) return order;
    }
    return collate(sources, s1, s2);
}

/** The value of a string literal, or the name of an identifier. */
function nameOf(node: Node | null | undefined): string {
    if (!node) return "";
    if (node.type === "Identifier") return node.name;
    if (node.type === "StringLiteral") return node.raw.slice(1, -1);
    return "";
}

/** How many line breaks start trivia, a blank line is two. */
function newlines(trivia: string): number {
    let count = 0;
    for (let index = 0; index < trivia.length; index++) {
        if (trivia[index] === "\r" && trivia[index + 1] === "\n") index++;
        if (trivia[index] !== "\n") break;
        count++;
    }
    return count;
}

/** The first line break of trivia. */
function newline(trivia: string): string {
    return trivia.startsWith("\r\n") ? "\r\n" : "\n";
}

/** Where the line break ending the last blank line of trivia is, two line breaks in a row. */
function lastBlank(trivia: string): number | undefined {
    for (let index = trivia.length - 1; index > 0; index--)
        if (trivia[index] === "\n") {
            const before = trivia[index - 1] === "\r" ? index - 2 : index - 1;
            if (trivia[before] === "\n") return before + 1;
        }
}

/** The trivia before its last blank line, with the comments detached from the statement. */
function detached(trivia: string): string | undefined {
    const index = lastBlank(trivia);
    return index === undefined ? undefined : trivia.slice(0, index);
}

/** The trivia from its last blank line on, with the comments attached to the statement. */
function attached(trivia: string): string | undefined {
    const index = lastBlank(trivia);
    return index === undefined ? undefined : trivia.slice(index);
}

/** Trivia without its leading line breaks and spaces. */
function trimLeading(trivia: string): string {
    return trivia.replace(/^\s+/, "");
}

/**
 * Organizes the imports and exports of a module like Biome's
 * organizeImports. Chunks of them, split by statements, by a switch
 * between imports and exports, by detached comments and by bare imports,
 * are sorted by source and kind, and the ones of a source merged when they
 * can be. Names in braces and attributes are sorted, and blank lines
 * separate chunks from what comes before them and statements from chunks
 * before them. This is one pass of Biome's, which it repeats until nothing
 * changes, as does fixing. Returns the change, undefined when organized.
 */
export default function organizeImports(
    program: Node,
    comments: Comment[],
    text: string,
    options: OrganizeOptions,
): Organized | undefined {
    if (program.type !== "Program" || program.body.length === 0) return;
    const compareNames = (a: string, b: string) =>
        options.identifierOrder === "natural"
            ? collate(names, a, b)
            : a < b
              ? -1
              : a > b
                ? 1
                : 0;
    const sorted = (keys: string[]) =>
        keys.every(
            (key, index) =>
                index === 0 ||
                compareNames(keys[index - 1] as string, key) <= 0,
        );
    /** The comments within a range. */
    const within = (start: number, end: number) =>
        comments.filter(
            (comment) => comment.start >= start && comment.end <= end,
        );

    /** Names in braces with their comments: on their line after them, or before them. */
    const units = (nodes: Node[], key: (node: Node) => string): Unit[] => {
        const list = nodes.map((node) => ({
            key: key(node),
            text: text.slice(node.start, node.end),
            lead: [] as Comment[],
            trail: [] as Comment[],
            node,
        }));
        const first = nodes[0];
        const last = nodes.at(-1);
        if (!first || !last) return list;
        const close = text.indexOf("}", last.end);
        for (const comment of within(
            first.start,
            close < 0 ? last.end : close,
        )) {
            const before = list.findLast(
                (unit) => unit.node.end <= comment.start,
            );
            const after = list.find((unit) => unit.node.start >= comment.end);
            if (
                before &&
                !text.slice(before.node.end, comment.start).includes("\n")
            )
                before.trail.push(comment);
            else (after ?? (before as Unit)).lead.push(comment);
        }
        return list.map(({ node: _, ...unit }) => unit);
    };

    /** The import or export a statement is, when it can be in a chunk. */
    const entryOf = (
        node: Node,
        slot: number,
        trail: string,
    ): Entry | undefined => {
        let entry: Entry;
        const statement = text.slice(node.start, node.end);
        const base = {
            slot,
            trail,
            statement,
            semicolon: statement.endsWith(";"),
            rewritable: true,
        };
        const attributesText = (source: Node | null, attributes: Node[]) =>
            source && attributes.length > 0
                ? text.slice(source.end, node.end).replace(/;\s*$/, "")
                : "";
        if (node.type === "ImportDeclaration") {
            if (node.phase !== null) return;
            const type = node.importKind === "type";
            let defaultName: string | undefined;
            let namespace: string | undefined;
            const named = node.specifiers.filter(
                (specifier) => specifier.type === "ImportSpecifier",
            );
            for (const specifier of node.specifiers)
                if (specifier.type === "ImportDefaultSpecifier")
                    defaultName = specifier.local.name;
                else if (specifier.type === "ImportNamespaceSpecifier")
                    namespace = `* as ${specifier.local.name}`;
            // `import {} from "a"` has braces, `import "a"` is bare
            const braces =
                named.length > 0 ||
                text.slice(node.start, node.source.start).includes("{");
            const kind =
                node.specifiers.length === 0 && !braces
                    ? Kind.Bare
                    : type
                      ? namespace
                          ? Kind.NamespaceType
                          : defaultName && !braces
                            ? Kind.DefaultType
                            : Kind.NamedType
                      : namespace
                        ? defaultName
                            ? Kind.DefaultNamespace
                            : Kind.Namespace
                        : defaultName
                          ? braces
                              ? Kind.DefaultNamed
                              : Kind.Default
                          : Kind.Named;
            entry = {
                ...base,
                exports: false,
                sourced: true,
                type,
                kind,
                source: nameOf(node.source),
                sourceRaw: text.slice(node.source.start, node.source.end),
                attributes: node.attributes,
                attributesText: attributesText(node.source, node.attributes),
            };
            if (defaultName) entry.defaultName = defaultName;
            if (namespace) entry.namespace = namespace;
            if (braces)
                entry.named = units(named, (specifier) =>
                    specifier.type === "ImportSpecifier"
                        ? specifier.local.name
                        : "",
                );
        } else if (
            node.type === "ExportAllDeclaration" ||
            (node.type === "ExportNamedDeclaration" && !node.declaration)
        ) {
            const type = node.exportKind === "type";
            const source = node.source;
            entry = {
                ...base,
                exports: true,
                sourced: source !== null,
                type,
                kind:
                    node.type === "ExportAllDeclaration"
                        ? type
                            ? Kind.NamespaceType
                            : Kind.Namespace
                        : type
                          ? Kind.NamedType
                          : Kind.Named,
                source: nameOf(source),
                sourceRaw: source ? text.slice(source.start, source.end) : "",
                attributes: node.attributes,
                attributesText: attributesText(source, node.attributes),
            };
            if (node.type === "ExportAllDeclaration")
                entry.namespace = node.exported
                    ? `* as ${text.slice(node.exported.start, node.exported.end)}`
                    : "*";
            else
                entry.named = units(node.specifiers, (specifier) =>
                    specifier.type === "ExportSpecifier"
                        ? nameOf(specifier.local)
                        : "",
                );
        } else return;
        // comments elsewhere in the statement would be lost printing it again
        const inBraces = new Set(
            (entry.named ?? []).flatMap((unit) => [
                ...unit.lead,
                ...unit.trail,
            ]),
        );
        entry.rewritable =
            within(node.start, node.end).every((comment) =>
                inBraces.has(comment),
            ) &&
            entry.attributes.every(
                (attribute) => attribute.type === "ImportAttribute",
            );
        return entry;
    };

    const attributeKeys = (entry: Entry) =>
        entry.attributes.map((attribute) =>
            attribute.type === "ImportAttribute" ? nameOf(attribute.key) : "",
        );
    const specifiersSorted = (entry: Entry) =>
        !entry.rewritable ||
        sorted((entry.named ?? []).map((unit) => unit.key));
    const attributesSorted = (entry: Entry) =>
        !entry.rewritable || sorted(attributeKeys(entry));

    const keyOrder = (a: Entry, b: Entry) =>
        Number(!a.sourced) - Number(!b.sourced) ||
        compareSources(a.source, b.source) ||
        Number(a.attributes.length === 0) - Number(b.attributes.length === 0) ||
        a.kind - b.kind ||
        a.slot - b.slot;

    /** Whether two statements of the same source can be one. */
    const mergeable = (a: Entry, b: Entry): boolean =>
        a.source === b.source &&
        a.sourced === b.sourced &&
        a.exports === b.exports &&
        a.type === b.type &&
        a.attributes.length === 0 &&
        b.attributes.length === 0 &&
        a.rewritable &&
        b.rewritable &&
        ((a.kind === Kind.NamedType && b.kind === Kind.NamedType) ||
            (a.kind === Kind.Named && b.kind === Kind.Named) ||
            (!a.exports &&
                !a.type &&
                ((a.kind === Kind.Namespace && b.kind === Kind.Default) ||
                    ((a.kind === Kind.Default ||
                        a.kind === Kind.DefaultNamed) &&
                        b.kind === Kind.Named))));

    /** One statement saying both, undefined when they cannot be one. */
    const merge = (a: Entry, b: Entry): Entry | undefined => {
        if (!mergeable(a, b)) return;
        const merged: Entry = { ...a, trail: joinTrails(a.trail, b.trail) };
        if (a.kind === Kind.Namespace) {
            merged.kind = Kind.DefaultNamespace;
            merged.defaultName = b.defaultName as string;
            delete merged.named;
        } else {
            if (a.kind === Kind.Default) merged.kind = Kind.DefaultNamed;
            merged.named = [...(a.named ?? []), ...(b.named ?? [])];
        }
        return merged;
    };

    /** The statement printed again with its names and attributes sorted. */
    const print = (entry: Entry): string => {
        let attributes = entry.attributesText;
        if (attributes && !sorted(attributeKeys(entry))) {
            const keyword = /^\s*(with|assert)\b/.exec(attributes)?.[1];
            const keyed = entry.attributes
                .map((attribute) => ({
                    key:
                        attribute.type === "ImportAttribute"
                            ? nameOf(attribute.key)
                            : "",
                    text: text.slice(attribute.start, attribute.end),
                }))
                .sort((a, b) => compareNames(a.key, b.key));
            attributes = ` ${keyword ?? "with"} { ${keyed.map((attribute) => attribute.text).join(", ")} }`;
        }
        const named = entry.named && printNamed(entry.named);
        const clause = entry.exports
            ? (entry.namespace ?? named ?? "{}")
            : [entry.defaultName, entry.namespace, named]
                  .filter((part) => part !== undefined)
                  .join(", ");
        const from = entry.sourced
            ? `${entry.kind === Kind.Bare ? "" : " from"} ${entry.sourceRaw}`
            : "";
        return `${entry.exports ? "export" : "import"} ${entry.type ? "type " : ""}${clause}${from}${attributes}${entry.semicolon ? ";" : ""}`.replace(
            "import  ",
            "import ",
        );
    };

    const printNamed = (list: Unit[]): string => {
        const units = [...list].sort((a, b) => compareNames(a.key, b.key));
        if (units.length === 0) return "{}";
        // a line comment needs a line of its own
        if (
            units.some((unit) =>
                [...unit.lead, ...unit.trail].some(
                    (comment) => comment.type === "Line",
                ),
            )
        )
            return `{\n${units
                .map(
                    (unit) =>
                        `${unit.lead.map((comment) => `    ${comment.value}\n`).join("")}    ${unit.text},${unit.trail.map((comment) => ` ${comment.value}`).join("")}`,
                )
                .join("\n")}\n}`;
        return `{ ${units
            .map((unit) =>
                [
                    ...unit.lead.map((comment) => comment.value),
                    unit.text,
                    ...unit.trail.map((comment) => comment.value),
                ].join(" "),
            )
            .join(", ")} }`;
    };

    // the statements with their trivia
    const slots: Slot[] = [];
    let previousEnd = start(program, comments, text);
    const prefix = text.slice(0, previousEnd);
    for (const [index, node] of program.body.entries()) {
        let end = node.end;
        // the comments on its line, and spaces, are its trailing trivia
        for (;;) {
            const spaces = /^[ \t]*/.exec(text.slice(end))?.[0].length ?? 0;
            const comment = comments.find(
                (comment) => comment.start === end + spaces,
            );
            if (!comment) {
                end += spaces;
                break;
            }
            end = comment.end;
        }
        const kind =
            node.type === "ImportDeclaration"
                ? "import"
                : node.type.startsWith("Export") ||
                    node.type === "TSExportAssignment" ||
                    node.type === "TSNamespaceExportDeclaration"
                  ? "export"
                  : node.type;
        const slot: Slot = {
            node,
            trivia: text.slice(previousEnd, node.start),
            text: text.slice(node.start, end),
            kind,
        };
        const entry = entryOf(node, index, text.slice(node.end, end));
        if (entry) slot.entry = entry;
        slots.push(slot);
        previousEnd = end;
    }

    // the issues, like Biome's run
    const ranges: { start: number; end: number }[] = [];
    const unorganized = new Map<
        number,
        { rewrite: boolean; newline: boolean }
    >();
    const leadingNewline = new Set<number>();
    let chunk: { start: number; end: number; max: Entry } | undefined;
    const endChunk = () => {
        if (chunk && chunk.end > chunk.start)
            ranges.push({ start: chunk.start, end: chunk.end });
        chunk = undefined;
    };
    let previousKind: string | undefined;
    let previousBare = false;
    for (const [index, slot] of slots.entries()) {
        const { entry } = slot;
        if (entry) {
            const distinct =
                previousKind !== undefined && previousKind !== slot.kind;
            const bare = entry.kind === Kind.Bare;
            if (
                distinct ||
                /\S/.test(detached(slot.trivia) ?? "") ||
                (!options.sortBareImports && (previousBare || bare))
            )
                endChunk();
            previousBare = bare;
            const rewrite =
                !specifiersSorted(entry) || !attributesSorted(entry);
            // a chunk after a statement of another kind starts with a blank line
            const missing = newlines(slot.trivia) === 1 && !chunk && distinct;
            if (rewrite || missing)
                unorganized.set(index, { rewrite, newline: missing });
            if (!chunk) chunk = { start: index, end: index, max: entry };
            else if (
                keyOrder(chunk.max, entry) > 0 ||
                mergeable(chunk.max, entry)
            )
                chunk.end = index + 1;
            else chunk.max = entry;
        } else if (chunk) {
            endChunk();
            // a statement after a chunk starts with a blank line, an export not
            if (slot.kind !== "export" && newlines(slot.trivia) === 1)
                leadingNewline.add(index);
            previousBare = false;
        }
        previousKind = slot.kind;
    }
    endChunk();
    if (
        ranges.length === 0 &&
        unorganized.size === 0 &&
        leadingNewline.size === 0
    )
        return;

    // the fix, like Biome's action
    const trivia = slots.map((slot) => slot.trivia);
    const texts = slots.map((slot) => slot.text);
    const removed = new Set<number>();
    for (const index of leadingNewline)
        trivia[index] = newline(trivia[index] as string) + trivia[index];
    const organized = new Map<
        number,
        { trivia: string; text: string; entry: Entry }
    >();
    for (const [index, issue] of unorganized) {
        const slot = slots[index] as Slot;
        const entry = slot.entry as Entry;
        organized.set(index, {
            trivia: issue.newline
                ? newline(slot.trivia) + slot.trivia
                : slot.trivia,
            text: issue.rewrite ? print(entry) + entry.trail : slot.text,
            entry,
        });
    }
    for (const range of ranges) {
        const keyed = slots
            .slice(range.start, range.end)
            .map((slot, offset) => {
                const index = range.start + offset;
                const item = organized.get(index) ?? {
                    trivia: slot.trivia,
                    text: slot.text,
                    entry: slot.entry as Entry,
                };
                organized.delete(index);
                return {
                    key: slot.entry as Entry,
                    merged: false,
                    item: item as typeof item | undefined,
                };
            });
        keyed.sort((a, b) => keyOrder(a.key, b.key));
        // merges from the last, by the keys before merging
        for (let index = keyed.length - 1; index > 0; index--) {
            const previous = keyed[index - 1] as (typeof keyed)[number];
            const current = keyed[index] as (typeof keyed)[number];
            if (!previous.item || !current.item) continue;
            if (!mergeable(previous.key, current.key)) continue;
            const entry = merge(previous.item.entry, current.item.entry);
            if (!entry) continue;
            previous.item = {
                trivia: mergeTrivia(previous.item.trivia, current.item.trivia),
                text: print(entry) + entry.trail,
                entry,
            };
            previous.merged = true;
            current.item = undefined;
        }
        for (const [offset, { key, merged, item }] of keyed.entries()) {
            const index = range.start + offset;
            const old = slots[index] as Slot;
            if (!item) {
                removed.add(index);
                continue;
            }
            if (index === key.slot && !merged) continue;
            let leading = item.trivia;
            if (index === range.start) {
                const before = detached(old.trivia);
                if (index === key.slot && merged) {
                    if (index === 0 && newlines(old.trivia) === 0)
                        leading = trimLeading(leading);
                } else if (before !== undefined)
                    leading =
                        newlines(old.trivia) === 1
                            ? newline(old.trivia) + before + leading
                            : before + leading;
                // the header of the module stays first
                else if (index === 0 && newlines(old.trivia) === 0)
                    leading =
                        old.trivia === ""
                            ? trimLeading(leading)
                            : old.trivia + leading;
            } else {
                const after = attached(leading);
                if (after !== undefined) leading = after;
                else if (key.slot === 0 && newlines(leading) === 0)
                    // without the header it had
                    leading = newline(leading);
            }
            trivia[index] = leading;
            texts[index] = item.text;
        }
    }
    for (const [index, item] of organized) {
        trivia[index] = item.trivia;
        texts[index] = item.text;
    }

    let output = prefix;
    for (const index of slots.keys())
        if (!removed.has(index))
            output += (trivia[index] as string) + (texts[index] as string);
    output += text.slice(previousEnd);
    if (output === text) return;

    const first = Math.min(
        ...ranges.map((range) => range.start),
        ...unorganized.keys(),
        ...[...leadingNewline].map((index) => index - 1),
    );
    const reported = slots[Math.max(first, 0)] as Slot;
    let from = 0;
    while (from < text.length && text[from] === output[from]) from++;
    let back = 0;
    while (
        back < text.length - from &&
        back < output.length - from &&
        text[text.length - 1 - back] === output[output.length - 1 - back]
    )
        back++;
    return {
        start: from,
        end: text.length - back,
        text: output.slice(from, output.length - back),
        report: reported.node.start,
        exports: reported.kind === "export",
    };
}

/** Where the trivia of the first statement starts, after directives and a hashbang. */
function start(program: Node, comments: Comment[], text: string): number {
    let end = 0;
    if (program.type === "Program") {
        const directive = program.directives.at(-1);
        if (directive) end = directive.end;
    }
    const hashbang = comments.find(
        (comment) => comment.start === 0 && comment.value.startsWith("#!"),
    );
    if (hashbang) end = Math.max(end, hashbang.end);
    // and the comments and spaces on that line
    for (;;) {
        const spaces = /^[ \t]*/.exec(text.slice(end))?.[0].length ?? 0;
        const comment = comments.find(
            (comment) => comment.start === end + spaces,
        );
        if (end === 0 || !comment) return end === 0 ? 0 : end + spaces;
        end = comment.end;
    }
}

/**
 * The trivia of a merged statement: the first's, as Biome keeps it, and
 * the comments of the second, which Biome drops.
 */
function mergeTrivia(first: string, second: string): string {
    if (first === "") return second;
    const comments = trimLeading(second);
    return comments === "" ? first : first + comments;
}

/** The comments after two merged statements, both kept. */
function joinTrails(first: string, second: string): string {
    const a = first.trimEnd();
    const b = second.trim();
    return b === "" ? first : a === "" ? ` ${b}` : `${a} ${b}`;
}
