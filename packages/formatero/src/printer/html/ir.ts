/**
 * Biome's formatting IR and printer, for HTML: unlike Prettier's documents,
 * spaces are pending until text follows, so they never end a line or double,
 * and line breaks at the start of a line do not add empty lines.
 */
export type IR = string | IR[] | Element;

export type LineMode = "soft" | "softOrSpace" | "hard" | "empty";
type Mode = "flat" | "expanded";

/** Text that may span lines, printed as is without indentation. */
interface Text {
    kind: "text";
    text: string;
}

/** Printed when the group, or the enclosing one, is in the mode. */
interface Conditional {
    kind: "conditional";
    mode: Mode;
    id?: symbol;
    contents: IR;
}

/** Items alternate with separators. */
interface Fill {
    kind: "fill";
    entries: IR[];
}

/** Content made at print time, knowing its indentation level. */
interface Embed {
    kind: "embed";
    render: (level: number) => string;
}

export type Element =
    | { kind: "space" }
    | { kind: "line"; mode: LineMode }
    | Text
    | { kind: "group"; contents: IR; id?: symbol; expand: boolean }
    | { kind: "indent"; contents: IR }
    | Conditional
    | { kind: "indentIfGroupBreaks"; id: symbol; contents: IR }
    | Fill
    | { kind: "expandParent" }
    | Embed;

export const space: Element = { kind: "space" };
export const softLine: Element = { kind: "line", mode: "soft" };
export const softLineOrSpace: Element = { kind: "line", mode: "softOrSpace" };
export const hardLine: Element = { kind: "line", mode: "hard" };
export const emptyLine: Element = { kind: "line", mode: "empty" };
export const expandParent: Element = { kind: "expandParent" };

export const text = (value: string): Element => ({ kind: "text", text: value });

export const group = (contents: IR, id?: symbol, expand = false): Element =>
    id
        ? { kind: "group", contents, id, expand }
        : { kind: "group", contents, expand };

export const indent = (contents: IR): Element => ({ kind: "indent", contents });

/** Indents the content on its own lines when the enclosing group breaks. */
export const softBlockIndent = (contents: IR): IR => [
    indent([softLine, contents]),
    softLine,
];

export const blockIndent = (contents: IR): IR => [
    indent([hardLine, contents]),
    hardLine,
];

/** A space, or the content indented on the next line when the enclosing group breaks. */
export const softLineIndentOrSpace = (contents: IR): IR =>
    indent([softLineOrSpace, contents]);

export const ifGroupBreaks = (contents: IR, id?: symbol): Element =>
    id
        ? { kind: "conditional", mode: "expanded", id, contents }
        : { kind: "conditional", mode: "expanded", contents };

export const ifGroupFitsOnLine = (contents: IR, id?: symbol): Element =>
    id
        ? { kind: "conditional", mode: "flat", id, contents }
        : { kind: "conditional", mode: "flat", contents };

export const indentIfGroupBreaks = (contents: IR, id: symbol): Element => ({
    kind: "indentIfGroupBreaks",
    id,
    contents,
});

export const fill = (entries: IR[]): Element => ({ kind: "fill", entries });

export const embed = (render: (level: number) => string): Element => ({
    kind: "embed",
    render,
});

/** Marks groups containing forced breaks as expanded, returning whether the IR expands. */
function propagate(ir: IR): boolean {
    if (typeof ir === "string") return ir.includes("\n");
    if (Array.isArray(ir)) {
        let expands = false;
        for (const part of ir) if (propagate(part)) expands = true;
        return expands;
    }
    switch (ir.kind) {
        case "line":
            return ir.mode === "hard" || ir.mode === "empty";
        case "text":
            return ir.text.includes("\n");
        case "expandParent":
        case "embed":
            return true;
        case "group":
            if (propagate(ir.contents)) ir.expand = true;
            return ir.expand;
        case "indent":
        case "conditional":
        case "indentIfGroupBreaks":
            return propagate(ir.contents);
        case "fill": {
            let expands = false;
            for (const entry of ir.entries)
                if (propagate(entry)) expands = true;
            return expands;
        }
        default:
            return false;
    }
}

/** Whether the IR contains a forced break, like Biome's `will_break`. */
export function willBreak(ir: IR): boolean {
    if (typeof ir === "string") return ir.includes("\n");
    if (Array.isArray(ir)) return ir.some(willBreak);
    switch (ir.kind) {
        case "line":
            return ir.mode === "hard" || ir.mode === "empty";
        case "text":
            return ir.text.includes("\n");
        case "expandParent":
        case "embed":
            return true;
        case "group":
            return ir.expand || willBreak(ir.contents);
        case "indent":
        case "conditional":
        case "indentIfGroupBreaks":
            return willBreak(ir.contents);
        case "fill":
            return ir.entries.some(willBreak);
        default:
            return false;
    }
}

export interface PrinterOptions {
    lineWidth: number;
    indentWidth: number;
    useTabs: boolean;
}

interface Command {
    ir: IR;
    mode: Mode;
    level: number;
}

type Fits = "yes" | "no" | "maybe";

/** The column width of text, wide characters take two columns. */
export function width(value: string): number {
    if (/^[\x20-\x7e]*$/.test(value)) return value.length;
    let total = 0;
    for (const char of value) {
        const code = char.codePointAt(0) ?? 0;
        if (/\p{M}/u.test(char) || code === 0x200b || code < 0x20) continue;
        total += wide(code) ? 2 : 1;
    }
    return total;
}

function wide(code: number): boolean {
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

/** Prints IR like Biome's printer. */
export class Printer {
    readonly #options: PrinterOptions;
    #out = "";
    #lineWidth = 0;
    #pendingIndent = 0;
    #pendingSpace = false;
    #measuredGroupFits = false;
    #hasEmptyLine = false;
    readonly #groupModes = new Map<symbol, Mode>();

    constructor(options: PrinterOptions) {
        this.#options = options;
    }

    print(ir: IR): string {
        propagate(ir);
        const stack: Command[] = [{ ir, mode: "expanded", level: 0 }];
        while (stack.length > 0) this.#element(stack.pop() as Command, stack);
        return this.#out;
    }

    #element(command: Command, stack: Command[]): void {
        const { ir, mode, level } = command;
        if (typeof ir === "string") {
            this.#text(ir);
            return;
        }
        if (Array.isArray(ir)) {
            for (let index = ir.length - 1; index >= 0; index--)
                stack.push({ ir: ir[index] as IR, mode, level });
            return;
        }
        switch (ir.kind) {
            case "space":
                if (this.#lineWidth > 0) this.#pendingSpace = true;
                return;
            case "text":
                this.#text(ir.text);
                return;
            case "embed": {
                // empty embedded content prints nothing, not even indentation
                const rendered = ir.render(level);
                if (rendered) this.#text(rendered);
                return;
            }
            case "line":
                if (mode === "flat") {
                    if (ir.mode === "soft" || ir.mode === "softOrSpace") {
                        if (ir.mode === "softOrSpace" && this.#lineWidth > 0)
                            this.#pendingSpace = true;
                        return;
                    }
                    this.#measuredGroupFits = false;
                }
                if (this.#lineWidth > 0) this.#newline();
                if (ir.mode === "empty" && !this.#hasEmptyLine) {
                    this.#newline();
                    this.#hasEmptyLine = true;
                }
                this.#pendingSpace = false;
                this.#pendingIndent = level;
                return;
            case "expandParent":
                return;
            case "group": {
                let groupMode: Mode;
                if (ir.expand) groupMode = "expanded";
                else if (mode === "flat" && this.#measuredGroupFits)
                    groupMode = "flat";
                else {
                    this.#measuredGroupFits = true;
                    if (ir.id) this.#groupModes.set(ir.id, "flat");
                    groupMode = this.#fits(
                        [{ ir: ir.contents, mode: "flat", level }],
                        stack,
                        false,
                    )
                        ? "flat"
                        : "expanded";
                }
                if (ir.id) this.#groupModes.set(ir.id, groupMode);
                stack.push({ ir: ir.contents, mode: groupMode, level });
                return;
            }
            case "indent":
                stack.push({ ir: ir.contents, mode, level: level + 1 });
                return;
            case "conditional": {
                const groupMode = ir.id
                    ? (this.#groupModes.get(ir.id) ?? mode)
                    : mode;
                if (groupMode === ir.mode)
                    stack.push({ ir: ir.contents, mode, level });
                return;
            }
            case "indentIfGroupBreaks": {
                const groupMode = this.#groupModes.get(ir.id) ?? mode;
                stack.push({
                    ir: ir.contents,
                    mode,
                    level: groupMode === "expanded" ? level + 1 : level,
                });
                return;
            }
            case "fill":
                this.#fill(ir.entries, mode, level, stack);
                return;
        }
    }

    #fill(entries: IR[], mode: Mode, level: number, stack: Command[]): void {
        if (this.#measuredGroupFits && mode === "flat") {
            stack.push({ ir: entries, mode: "flat", level });
            return;
        }
        let index = 0;
        // entries are printed in order here, groups in them measure the later entries and what follows the fill
        const print = (ir: IR, entryMode: Mode) => {
            const base = [
                ...stack,
                ...entries
                    .slice(index + 1)
                    .reverse()
                    .map((entry) => ({ ir: entry, mode, level })),
            ];
            const local: Command[] = [...base, { ir, mode: entryMode, level }];
            while (local.length > base.length)
                this.#element(local.pop() as Command, local);
        };
        while (index < entries.length) {
            const measurer = this.#measurer(stack, true);
            let flatPairs = 0;
            let layout:
                | "flat"
                | "itemFlatSeparatorExpanded"
                | "expanded"
                | "itemMaybeFlat";
            let cursor = index;
            if (measurer.entry(entries[cursor] as IR, "flat", level)) {
                for (;;) {
                    if (cursor + 1 >= entries.length) {
                        layout = "flat";
                        break;
                    }
                    if (
                        !measurer.entry(
                            entries[cursor + 1] as IR,
                            "flat",
                            level,
                        )
                    ) {
                        layout = "itemMaybeFlat";
                        break;
                    }
                    if (cursor + 2 >= entries.length) {
                        layout = "flat";
                        break;
                    }
                    if (
                        measurer.entry(entries[cursor + 2] as IR, "flat", level)
                    ) {
                        flatPairs++;
                        cursor += 2;
                    } else {
                        layout = "itemFlatSeparatorExpanded";
                        break;
                    }
                }
            } else layout = "expanded";
            this.#measuredGroupFits = true;

            for (let pair = 0; pair < flatPairs; pair++) {
                print(entries[index] as IR, "flat");
                print(entries[index + 1] as IR, "flat");
                index += 2;
            }
            let itemMode: Mode;
            if (layout === "flat" || layout === "itemFlatSeparatorExpanded")
                itemMode = "flat";
            else if (layout === "expanded") itemMode = "expanded";
            else {
                const again = this.#measurer(stack, true);
                again.entry(entries[index] as IR, "flat", level);
                itemMode =
                    index + 1 < entries.length &&
                    again.entry(entries[index + 1] as IR, "expanded", level)
                        ? "flat"
                        : "expanded";
            }
            print(entries[index] as IR, itemMode);
            index++;
            if (index < entries.length) {
                print(
                    entries[index] as IR,
                    layout === "flat" ? "flat" : "expanded",
                );
                index++;
            }
        }
    }

    #newline(): void {
        this.#out += "\n";
        this.#lineWidth = 0;
        this.#measuredGroupFits = false;
    }

    #indentation(level: number): string {
        return this.#options.useTabs
            ? "\t".repeat(level)
            : " ".repeat(level * this.#options.indentWidth);
    }

    #text(value: string): void {
        if (this.#pendingIndent > 0) {
            const indentation = this.#indentation(this.#pendingIndent);
            this.#out += indentation;
            this.#lineWidth += this.#options.useTabs
                ? this.#pendingIndent * this.#options.indentWidth
                : indentation.length;
            this.#hasEmptyLine = false;
            this.#pendingIndent = 0;
        }
        if (this.#pendingSpace) {
            this.#out += " ";
            this.#lineWidth++;
            this.#hasEmptyLine = false;
            this.#pendingSpace = false;
        }
        if (!value.includes("\n")) {
            this.#out += value;
            this.#lineWidth += this.#width(value);
            if (value) this.#hasEmptyLine = false;
            return;
        }
        const lines = value.split("\n");
        for (const [index, line] of lines.entries()) {
            if (index > 0) this.#newline();
            this.#out += line;
            this.#lineWidth += this.#width(line);
            if (line) this.#hasEmptyLine = false;
        }
    }

    #width(value: string): number {
        if (!value.includes("\t")) return width(value);
        let total = 0;
        for (const part of value.split("\t")) total += width(part);
        return (
            total + (value.split("\t").length - 1) * this.#options.indentWidth
        );
    }

    #fits(first: Command[], rest: Command[], mustBeFlat: boolean): boolean {
        const measurer = this.#measurer(rest, mustBeFlat);
        return measurer.run(first);
    }

    #measurer(rest: Command[], mustBeFlat: boolean): Measurer {
        return new Measurer(
            {
                lineWidth: this.#lineWidth,
                pendingIndent: this.#pendingIndent,
                pendingSpace: this.#pendingSpace,
            },
            rest,
            mustBeFlat,
            this.#options,
            this.#groupModes,
            (value) => this.#width(value),
            (level) => this.#indentWidth(level),
        );
    }

    #indentWidth(level: number): number {
        return level * this.#options.indentWidth;
    }
}

/** Measures whether content fits on the current line, Biome's `FitsMeasurer`. */
class Measurer {
    #lineWidth: number;
    #pendingIndent: number;
    #pendingSpace: boolean;
    /** What follows the measured content, from the top of the print stack down. */
    #rest: Command[];
    readonly #mustBeFlat: boolean;
    readonly #options: PrinterOptions;
    readonly #groupModes: Map<symbol, Mode>;
    readonly #local = new Map<symbol, Mode>();
    readonly #textWidth: (value: string) => number;
    readonly #indentWidth: (level: number) => number;

    constructor(
        state: {
            lineWidth: number;
            pendingIndent: number;
            pendingSpace: boolean;
        },
        rest: Command[],
        mustBeFlat: boolean,
        options: PrinterOptions,
        groupModes: Map<symbol, Mode>,
        textWidth: (value: string) => number,
        indentWidth: (level: number) => number,
    ) {
        this.#lineWidth = state.lineWidth;
        this.#pendingIndent = state.pendingIndent;
        this.#pendingSpace = state.pendingSpace;
        this.#rest = [...rest];
        this.#mustBeFlat = mustBeFlat;
        this.#options = options;
        this.#groupModes = groupModes;
        this.#textWidth = textWidth;
        this.#indentWidth = indentWidth;
    }

    /** Whether the commands, then the rest of the document, fit up to the next line break. */
    run(commands: Command[]): boolean {
        const stack = [...commands].reverse();
        for (;;) {
            const command = stack.pop() ?? this.#rest.pop();
            if (!command) return true;
            const result = this.#element(command, stack);
            if (result !== "maybe") return result === "yes";
        }
    }

    /** Whether one fill entry fits, continuing the measured line. */
    entry(ir: IR, mode: Mode, level: number): boolean {
        const stack: Command[] = [{ ir, mode, level }];
        while (stack.length > 0) {
            const result = this.#element(stack.pop() as Command, stack);
            if (result !== "maybe") return result === "yes";
        }
        return true;
    }

    #mode(id: symbol | undefined, mode: Mode): Mode {
        if (!id) return mode;
        return this.#local.get(id) ?? this.#groupModes.get(id) ?? mode;
    }

    #element(command: Command, stack: Command[]): Fits {
        const { ir, mode, level } = command;
        if (typeof ir === "string") return this.#text(ir);
        if (Array.isArray(ir)) {
            for (let index = ir.length - 1; index >= 0; index--)
                stack.push({ ir: ir[index] as IR, mode, level });
            return "maybe";
        }
        switch (ir.kind) {
            case "space":
                if (this.#lineWidth > 0) this.#pendingSpace = true;
                return "maybe";
            case "line":
                if (mode === "flat") {
                    if (ir.mode === "softOrSpace") this.#pendingSpace = true;
                    if (ir.mode === "soft" || ir.mode === "softOrSpace")
                        return "maybe";
                    return "yes";
                }
                return "yes";
            case "text":
                return this.#text(ir.text);
            case "embed":
                return this.#mustBeFlat ? "no" : "yes";
            case "expandParent":
                return this.#mustBeFlat ? "no" : "maybe";
            case "group": {
                if (this.#mustBeFlat && ir.expand) return "no";
                const groupMode: Mode = ir.expand ? "expanded" : mode;
                if (ir.id) this.#local.set(ir.id, groupMode);
                stack.push({ ir: ir.contents, mode: groupMode, level });
                return "maybe";
            }
            case "indent":
                stack.push({ ir: ir.contents, mode, level: level + 1 });
                return "maybe";
            case "conditional":
                if (this.#mode(ir.id, mode) === ir.mode)
                    stack.push({ ir: ir.contents, mode, level });
                return "maybe";
            case "indentIfGroupBreaks":
                stack.push({
                    ir: ir.contents,
                    mode,
                    level:
                        this.#mode(ir.id, mode) === "expanded"
                            ? level + 1
                            : level,
                });
                return "maybe";
            case "fill":
                stack.push({ ir: ir.entries, mode, level });
                return "maybe";
        }
    }

    #text(value: string): Fits {
        this.#lineWidth += this.#indentWidth(this.#pendingIndent);
        this.#pendingIndent = 0;
        if (this.#pendingSpace) this.#lineWidth++;
        const newline = value.indexOf("\n");
        if (newline >= 0) {
            this.#lineWidth += this.#textWidth(value.slice(0, newline));
            return this.#mustBeFlat || this.#lineWidth > this.#options.lineWidth
                ? "no"
                : "yes";
        }
        this.#lineWidth += this.#textWidth(value);
        if (this.#lineWidth > this.#options.lineWidth) return "no";
        this.#pendingSpace = false;
        return "maybe";
    }
}
