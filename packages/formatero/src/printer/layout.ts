import type { Doc, Group } from "./doc.js";

export interface LayoutOptions {
    lineWidth: number;
    useTabs: boolean;
    indentWidth: number;
}

type Mode = "break" | "flat";

interface Indentation {
    value: string;
    length: number;
    queue: ({ type: "indent" } | { type: "align"; width: number })[];
}

interface Command {
    indentation: Indentation;
    mode: Mode;
    doc: Doc;
}

/** Lays documents out within the line width. */
export default class Layout {
    readonly #options: LayoutOptions;
    readonly #groupModes = new Map<symbol, Mode>();

    constructor(options: LayoutOptions) {
        this.#options = options;
    }

    static width(text: string): number {
        if (/^[\x20-\x7e]*$/.test(text)) return text.length;
        let width = 0;
        for (const char of text) {
            const code = char.codePointAt(0) ?? 0;
            if (/\p{M}/u.test(char) || code === 0x200b) continue;
            width += Layout.#wide(code) ? 2 : 1;
        }
        return width;
    }

    static #wide(code: number): boolean {
        return (
            (code >= 0x1100 && code <= 0x115f) ||
            (code >= 0x2e80 && code <= 0xa4cf) ||
            (code >= 0xac00 && code <= 0xd7a3) ||
            (code >= 0xf900 && code <= 0xfaff) ||
            (code >= 0xfe30 && code <= 0xfe4f) ||
            (code >= 0xff00 && code <= 0xff60) ||
            (code >= 0xffe0 && code <= 0xffe6) ||
            (code >= 0x1f300 && code <= 0x1f64f) ||
            (code >= 0x1f900 && code <= 0x1f9ff) ||
            (code >= 0x20000 && code <= 0x3fffd)
        );
    }

    print(doc: Doc): string {
        Layout.#propagateBreaks(doc);
        this.#groupModes.clear();

        const root: Indentation = { value: "", length: 0, queue: [] };
        const commands: Command[] = [{ indentation: root, mode: "break", doc }];
        const out: string[] = [];
        const lineSuffixes: Command[] = [];
        let position = 0;
        let remeasure = false;

        while (commands.length > 0) {
            const { indentation, mode, doc } = commands.pop() as Command;

            if (typeof doc === "string") {
                out.push(doc);
                position += Layout.width(doc);
            } else if (Array.isArray(doc)) {
                for (let index = doc.length - 1; index >= 0; index--)
                    commands.push({
                        indentation,
                        mode,
                        doc: doc[index] as Doc,
                    });
            } else {
                switch (doc.type) {
                    case "indent":
                        commands.push({
                            indentation: this.#indent(indentation, {
                                type: "indent",
                            }),
                            mode,
                            doc: doc.contents,
                        });
                        break;
                    case "align":
                        commands.push({
                            indentation: this.#align(indentation, doc.width),
                            mode,
                            doc: doc.contents,
                        });
                        break;
                    case "group": {
                        if (mode === "flat" && !remeasure) {
                            commands.push({
                                indentation,
                                mode: doc.break ? "break" : "flat",
                                doc: doc.contents,
                            });
                        } else {
                            remeasure = false;
                            const next: Command = {
                                indentation,
                                mode: "flat",
                                doc: doc.contents,
                            };
                            const rest = this.#options.lineWidth - position;
                            const hasLineSuffix = lineSuffixes.length > 0;

                            if (
                                !doc.break &&
                                this.#fits(
                                    next,
                                    commands,
                                    rest,
                                    hasLineSuffix,
                                    false,
                                )
                            )
                                commands.push(next);
                            else if (doc.expandedStates) {
                                const expanded = doc.expandedStates.at(
                                    -1,
                                ) as Doc;
                                if (doc.break)
                                    commands.push({
                                        indentation,
                                        mode: "break",
                                        doc: expanded,
                                    });
                                else {
                                    for (
                                        let index = 1;
                                        index <= doc.expandedStates.length;
                                        index++
                                    ) {
                                        if (
                                            index >= doc.expandedStates.length
                                        ) {
                                            commands.push({
                                                indentation,
                                                mode: "break",
                                                doc: expanded,
                                            });
                                            break;
                                        }
                                        const state: Command = {
                                            indentation,
                                            mode: "flat",
                                            doc: doc.expandedStates[
                                                index
                                            ] as Doc,
                                        };
                                        if (
                                            this.#fits(
                                                state,
                                                commands,
                                                rest,
                                                hasLineSuffix,
                                                false,
                                            )
                                        ) {
                                            commands.push(state);
                                            break;
                                        }
                                    }
                                }
                            } else
                                commands.push({
                                    indentation,
                                    mode: "break",
                                    doc: doc.contents,
                                });
                        }
                        if (doc.id)
                            this.#groupModes.set(
                                doc.id,
                                (commands.at(-1) as Command).mode,
                            );
                        break;
                    }
                    case "fill":
                        this.#fill(
                            doc.parts,
                            indentation,
                            mode,
                            commands,
                            this.#options.lineWidth - position,
                            lineSuffixes.length > 0,
                        );
                        break;
                    case "if-break":
                    case "indent-if-break": {
                        const groupMode = doc.groupId
                            ? (this.#groupModes.get(doc.groupId) ?? "flat")
                            : mode;
                        const contents =
                            doc.type === "if-break"
                                ? groupMode === "break"
                                    ? doc.breakContents
                                    : doc.flatContents
                                : groupMode === "break"
                                  ? {
                                        type: "indent" as const,
                                        contents: doc.contents,
                                    }
                                  : doc.contents;
                        commands.push({ indentation, mode, doc: contents });
                        break;
                    }
                    case "line-suffix":
                        lineSuffixes.push({
                            indentation,
                            mode,
                            doc: doc.contents,
                        });
                        break;
                    case "line-suffix-boundary":
                        if (lineSuffixes.length > 0)
                            commands.push({
                                indentation,
                                mode,
                                doc: { type: "line", hard: true },
                            });
                        break;
                    case "line":
                        if (mode === "flat" && !doc.hard) {
                            if (!doc.soft) {
                                out.push(" ");
                                position += 1;
                            }
                            break;
                        }
                        if (mode === "flat") remeasure = true;
                        if (lineSuffixes.length > 0) {
                            commands.push(
                                { indentation, mode, doc },
                                ...lineSuffixes.reverse(),
                            );
                            lineSuffixes.length = 0;
                            break;
                        }
                        if (doc.literal) {
                            out.push("\n");
                            position = 0;
                        } else {
                            Layout.#trim(out);
                            out.push(`\n${indentation.value}`);
                            position = indentation.length;
                        }
                        break;
                    case "label":
                        commands.push({ indentation, mode, doc: doc.contents });
                        break;
                    case "break-parent":
                    case "reserve":
                        break;
                }
            }

            if (commands.length === 0 && lineSuffixes.length > 0) {
                commands.push(...lineSuffixes.reverse());
                lineSuffixes.length = 0;
            }
        }

        return out.join("");
    }

    #fill(
        parts: Doc[],
        indentation: Indentation,
        mode: Mode,
        commands: Command[],
        rest: number,
        hasLineSuffix: boolean,
    ): void {
        if (parts.length === 0) return;
        const [content, whitespace] = parts as [Doc, Doc | undefined];
        const contentFlat: Command = {
            indentation,
            mode: "flat",
            doc: content,
        };
        const contentBreak: Command = {
            indentation,
            mode: "break",
            doc: content,
        };
        const contentFits = this.#fits(
            contentFlat,
            [],
            rest,
            hasLineSuffix,
            true,
        );

        if (parts.length === 1) {
            commands.push(contentFits ? contentFlat : contentBreak);
            return;
        }

        const whitespaceFlat: Command = {
            indentation,
            mode: "flat",
            doc: whitespace as Doc,
        };
        const whitespaceBreak: Command = {
            indentation,
            mode: "break",
            doc: whitespace as Doc,
        };

        if (parts.length === 2) {
            if (contentFits) commands.push(whitespaceFlat, contentFlat);
            else commands.push(whitespaceBreak, contentBreak);
            return;
        }

        const remaining: Command = {
            indentation,
            mode,
            doc: { type: "fill", parts: parts.slice(2) },
        };
        const pair: Command = {
            indentation,
            mode: "flat",
            doc: [content, whitespace as Doc, parts[2] as Doc],
        };

        if (this.#fits(pair, [], rest, hasLineSuffix, true))
            commands.push(remaining, whitespaceFlat, contentFlat);
        else if (contentFits)
            commands.push(remaining, whitespaceBreak, contentFlat);
        else commands.push(remaining, whitespaceBreak, contentBreak);
    }

    /** Whether the command fits in the rest of the line, followed by the rest commands. */
    #fits(
        next: Command,
        restCommands: Command[],
        width: number,
        hasLineSuffix: boolean,
        mustBeFlat: boolean,
    ): boolean {
        let rest = width;
        let restIndex = restCommands.length;
        let suffix = hasLineSuffix;
        const commands: { mode: Mode; doc: Doc }[] = [
            { mode: next.mode, doc: next.doc },
        ];

        while (rest >= 0) {
            if (commands.length === 0) {
                if (restIndex === 0) return true;
                const command = restCommands[--restIndex] as Command;
                commands.push({
                    mode: command.mode,
                    doc: command.doc,
                });
                continue;
            }

            const { mode, doc } = commands.pop() as { mode: Mode; doc: Doc };

            if (typeof doc === "string") rest -= Layout.width(doc);
            else if (Array.isArray(doc)) {
                for (let index = doc.length - 1; index >= 0; index--)
                    commands.push({
                        mode,
                        doc: doc[index] as Doc,
                    });
            } else {
                switch (doc.type) {
                    case "fill":
                        for (
                            let index = doc.parts.length - 1;
                            index >= 0;
                            index--
                        )
                            commands.push({
                                mode,
                                doc: doc.parts[index] as Doc,
                            });
                        break;
                    case "indent":
                    case "align":
                    case "indent-if-break":
                    case "label":
                        commands.push({
                            mode,
                            doc: doc.contents,
                        });
                        break;
                    case "group": {
                        if (mustBeFlat && doc.break) return false;
                        const groupMode: Mode = doc.break ? "break" : mode;
                        const contents =
                            doc.expandedStates && groupMode === "break"
                                ? (doc.expandedStates.at(-1) as Doc)
                                : doc.contents;
                        commands.push({
                            mode: groupMode,
                            doc: contents,
                        });
                        break;
                    }
                    case "if-break": {
                        const groupMode = doc.groupId
                            ? (this.#groupModes.get(doc.groupId) ?? "flat")
                            : mode;
                        commands.push({
                            mode,
                            doc:
                                groupMode === "break"
                                    ? doc.breakContents
                                    : doc.flatContents,
                        });
                        break;
                    }
                    case "line":
                        if (mode === "break" || doc.hard) return true;
                        if (!doc.soft) rest -= 1;
                        break;
                    case "line-suffix":
                        suffix = true;
                        break;
                    case "line-suffix-boundary":
                        if (suffix) return true;
                        break;
                    case "reserve":
                        rest -= doc.width;
                        break;
                }
            }
        }

        return false;
    }

    #indent(
        indentation: Indentation,
        part: Indentation["queue"][number],
    ): Indentation {
        return this.#make([...indentation.queue, part]);
    }

    #align(indentation: Indentation, width: number): Indentation {
        if (width === 0) return indentation;
        if (width === Number.NEGATIVE_INFINITY)
            return { value: "", length: 0, queue: [] };
        if (width < 0) return this.#make(indentation.queue.slice(0, -1));
        return this.#indent(indentation, { type: "align", width });
    }

    /** Builds indentation like Prettier: alignment before indentation becomes tabs, trailing alignment spaces. */
    #make(queue: Indentation["queue"]): Indentation {
        const { useTabs, indentWidth } = this.#options;
        let value = "";
        let length = 0;
        let tabs = 0;
        let spaces = 0;

        const flushTabs = () => {
            value += "\t".repeat(tabs);
            length += indentWidth * tabs;
        };
        const flushSpaces = () => {
            value += " ".repeat(spaces);
            length += spaces;
        };

        for (const part of queue) {
            if (part.type === "indent") {
                if (useTabs) flushTabs();
                else flushSpaces();
                tabs = 0;
                spaces = 0;
                value += useTabs ? "\t" : " ".repeat(indentWidth);
                length += indentWidth;
            } else {
                tabs += 1;
                spaces += part.width;
            }
        }
        flushSpaces();

        return { value, length, queue };
    }

    /** Removes trailing spaces and tabs from the output. */
    static #trim(out: string[]): void {
        while (out.length > 0) {
            const trimmed = (out.at(-1) as string).replace(/[ \t]+$/, "");
            if (trimmed) {
                out[out.length - 1] = trimmed;
                return;
            }
            out.pop();
        }
    }

    /** Marks groups containing forced breaks as broken, like Prettier's propagateBreaks. */
    static #propagateBreaks(doc: Doc): void {
        const visited = new Set<Group>();
        const groups: Group[] = [];
        const exit = Symbol("exit");
        const stack: (Doc | typeof exit)[] = [doc];

        const breakParent = () => {
            const parent = groups.at(-1);
            if (parent && !parent.expandedStates && !parent.break)
                parent.break = true;
        };

        while (stack.length > 0) {
            const current = stack.pop() as Doc | typeof exit;

            if (current === exit) {
                const child = groups.pop() as Group;
                if (child.break) breakParent();
                continue;
            }
            if (typeof current === "string") continue;
            if (Array.isArray(current)) {
                for (let index = current.length - 1; index >= 0; index--)
                    stack.push(current[index] as Doc);
                continue;
            }

            switch (current.type) {
                case "break-parent":
                    breakParent();
                    break;
                case "group": {
                    groups.push(current);
                    stack.push(exit);
                    if (visited.has(current)) break;
                    visited.add(current);
                    const children = current.expandedStates ?? [
                        current.contents,
                    ];
                    for (let index = children.length - 1; index >= 0; index--)
                        stack.push(children[index] as Doc);
                    break;
                }
                case "fill":
                    for (
                        let index = current.parts.length - 1;
                        index >= 0;
                        index--
                    )
                        stack.push(current.parts[index] as Doc);
                    break;
                case "if-break":
                    stack.push(current.flatContents, current.breakContents);
                    break;
                case "align":
                case "indent":
                case "indent-if-break":
                case "label":
                case "line-suffix":
                    stack.push(current.contents);
                    break;
            }
        }
    }
}
