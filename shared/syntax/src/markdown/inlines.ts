import type { Inline, Link } from "./ast.js";
import Scan, { CLOSE_TAG, OPEN_TAG } from "./scan.js";

type Kind =
    | "text"
    | "softbreak"
    | "hardbreak"
    | "code"
    | "emph"
    | "strong"
    | "del"
    | "link"
    | "image"
    | "autolink"
    | "html";

/** A mutable inline node, linked to its siblings while emphasis is resolved. */
class Item {
    kind: Kind;
    start: number;
    end: number;
    parent: Item | null = null;
    first: Item | null = null;
    last: Item | null = null;
    prev: Item | null = null;
    next: Item | null = null;
    delimiter = "";
    tail = "";
    reference: Link["reference"] = null;
    label: string | null = null;
    destination = "";
    title: string | null = null;

    constructor(kind: Kind, start: number, end: number) {
        this.kind = kind;
        this.start = start;
        this.end = end;
    }

    append(child: Item): void {
        child.unlink();
        child.parent = this;
        if (this.last) {
            this.last.next = child;
            child.prev = this.last;
        } else this.first = child;
        this.last = child;
    }

    insertAfter(sibling: Item): void {
        sibling.unlink();
        sibling.next = this.next;
        if (sibling.next) sibling.next.prev = sibling;
        sibling.prev = this;
        this.next = sibling;
        sibling.parent = this.parent;
        if (this.parent && !sibling.next) this.parent.last = sibling;
    }

    unlink(): void {
        if (this.prev) this.prev.next = this.next;
        else if (this.parent) this.parent.first = this.next;
        if (this.next) this.next.prev = this.prev;
        else if (this.parent) this.parent.last = this.prev;
        this.parent = null;
        this.next = null;
        this.prev = null;
    }
}

interface Delimiter {
    char: string;
    count: number;
    original: number;
    item: Item;
    previous: Delimiter | null;
    next: Delimiter | null;
    canOpen: boolean;
    canClose: boolean;
}

interface Bracket {
    item: Item;
    previous: Bracket | null;
    previousDelimiter: Delimiter | null;
    index: number;
    image: boolean;
    active: boolean;
    bracketAfter: boolean;
}

const ENTITY =
    /^&(?:#[xX][a-fA-F0-9]{1,6}|#[0-9]{1,7}|[A-Za-z][A-Za-z0-9]{1,31});/;
const AUTOLINK = /^<[A-Za-z][A-Za-z0-9.+-]{1,31}:[^<>\p{Cc} ]*>/u;
const EMAIL =
    /^<[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*>/;
const HTML_TAG = new RegExp(
    `^(?:${OPEN_TAG}|${CLOSE_TAG}|<!-->|<!--->|<!--[\\s\\S]*?-->|[<][?][\\s\\S]*?[?][>]|<![A-Za-z][^>]*>|<!\\[CDATA\\[[\\s\\S]*?\\]\\]>)`,
    "i",
);
const PUNCTUATION = /[\p{P}\p{S}]/u;
const WHITESPACE = /[\s\p{Zs}]/u;

/** Parses the inline content of paragraphs, headings and table cells. */
export default class Inlines {
    readonly #labels: Set<string>;
    readonly #gfm: boolean;
    #text = "";
    #position = 0;
    #delimiters: Delimiter | null = null;
    #brackets: Bracket | null = null;

    constructor(labels: Set<string>, gfm: boolean) {
        this.#labels = labels;
        this.#gfm = gfm;
    }

    parse(text: string): Inline[] {
        this.#text = text;
        this.#position = 0;
        this.#delimiters = null;
        this.#brackets = null;
        const root = new Item("text", 0, text.length);
        while (this.#position < text.length) this.#inline(root);
        this.#processEmphasis(null);
        return Inlines.#convert(root, text);
    }

    #inline(block: Item): void {
        const text = this.#text;
        const char = text[this.#position] as string;
        switch (char) {
            case "\n":
                this.#newline(block);
                return;
            case "\\":
                this.#backslash(block);
                return;
            case "`":
                this.#backticks(block);
                return;
            case "~":
                if (!this.#gfm) break;
                this.#delimiter(block, char);
                return;
            case "*":
            case "_":
                this.#delimiter(block, char);
                return;
            case "!":
                if (text[this.#position + 1] !== "[") break;
                this.#openBracket(block, true);
                return;
            case "[":
                this.#openBracket(block, false);
                return;
            case "]":
                this.#closeBracket(block);
                return;
            case "<": {
                const rest = text.slice(this.#position);
                const match = AUTOLINK.exec(rest) ?? EMAIL.exec(rest);
                const tag = match ? null : HTML_TAG.exec(rest);
                if (match || tag) {
                    this.#add(
                        block,
                        match ? "autolink" : "html",
                        ((match ?? tag) as RegExpExecArray)[0].length,
                    );
                    return;
                }
                break;
            }
            case "&": {
                const entity = ENTITY.exec(text.slice(this.#position));
                if (entity) {
                    this.#add(block, "text", entity[0].length);
                    return;
                }
                break;
            }
        }
        const special = this.#gfm ? /[\n`[\]\\!<&*_~]/g : /[\n`[\]\\!<&*_]/g;
        special.lastIndex = this.#position + 1;
        const next = special.exec(text);
        this.#add(
            block,
            "text",
            (next ? next.index : text.length) - this.#position,
        );
    }

    #add(block: Item, kind: Kind, length: number): Item {
        const item = new Item(kind, this.#position, this.#position + length);
        block.append(item);
        this.#position += length;
        return item;
    }

    #newline(block: Item): void {
        const last = block.last;
        let start = this.#position;
        let hard = false;
        if (last?.kind === "text" && this.#text[last.end - 1] === " ") {
            let spaces = last.end;
            while (spaces > last.start && this.#text[spaces - 1] === " ")
                spaces--;
            hard = last.end - spaces >= 2;
            start = spaces;
            last.end = spaces;
            if (last.end === last.start) last.unlink();
        }
        const item = new Item(
            hard ? "hardbreak" : "softbreak",
            start,
            this.#position + 1,
        );
        block.append(item);
        this.#position++;
        while (this.#text[this.#position] === " ") this.#position++;
    }

    #backslash(block: Item): void {
        const next = this.#text[this.#position + 1];
        if (next === "\n") {
            this.#add(block, "hardbreak", 2);
            while (this.#text[this.#position] === " ") this.#position++;
        } else if (next !== undefined && /[!-/:-@[-`{-~]/.test(next))
            this.#add(block, "text", 2);
        else this.#add(block, "text", 1);
    }

    #backticks(block: Item): void {
        const text = this.#text;
        const run = /^`+/.exec(text.slice(this.#position))?.[0] as string;
        const pattern = /`+/g;
        pattern.lastIndex = this.#position + run.length;
        for (let match = pattern.exec(text); match; match = pattern.exec(text))
            if (match[0].length === run.length) {
                this.#add(
                    block,
                    "code",
                    match.index + run.length - this.#position,
                );
                return;
            }
        this.#add(block, "text", run.length);
    }

    #delimiter(block: Item, char: string): void {
        const text = this.#text;
        const start = this.#position;
        let end = start;
        while (text[end] === char) end++;
        const count = end - start;
        const before = start === 0 ? "\n" : Inlines.#charBefore(text, start);
        const after = end >= text.length ? "\n" : Inlines.#charAt(text, end);
        const afterSpace = WHITESPACE.test(after);
        const afterPunct = PUNCTUATION.test(after);
        const beforeSpace = WHITESPACE.test(before);
        const beforePunct = PUNCTUATION.test(before);
        const left = !afterSpace && (!afterPunct || beforeSpace || beforePunct);
        const right =
            !beforeSpace && (!beforePunct || afterSpace || afterPunct);
        let canOpen: boolean;
        let canClose: boolean;
        if (char === "_") {
            canOpen = left && (!right || beforePunct);
            canClose = right && (!left || afterPunct);
        } else {
            canOpen = left;
            canClose = right;
        }
        if (char === "~" && count > 2) {
            canOpen = false;
            canClose = false;
        }
        const item = this.#add(block, "text", count);
        this.#delimiters = {
            char,
            count,
            original: count,
            item,
            previous: this.#delimiters,
            next: null,
            canOpen,
            canClose,
        };
        if (this.#delimiters.previous)
            this.#delimiters.previous.next = this.#delimiters;
    }

    static #charBefore(text: string, index: number): string {
        const code = text.codePointAt(index - 2);
        if (code !== undefined && code > 0xffff)
            return String.fromCodePoint(code);
        return text[index - 1] as string;
    }

    static #charAt(text: string, index: number): string {
        return String.fromCodePoint(text.codePointAt(index) as number);
    }

    #openBracket(block: Item, image: boolean): void {
        const start = this.#position;
        const item = this.#add(block, "text", image ? 2 : 1);
        if (this.#brackets) this.#brackets.bracketAfter = true;
        this.#brackets = {
            item,
            previous: this.#brackets,
            previousDelimiter: this.#delimiters,
            index: start + (image ? 2 : 1),
            image,
            active: true,
            bracketAfter: false,
        };
    }

    #closeBracket(block: Item): void {
        const text = this.#text;
        const close = this.#position;
        this.#position++;
        const opener = this.#brackets;
        if (!opener) {
            block.append(new Item("text", close, close + 1));
            return;
        }
        if (!opener.active) {
            block.append(new Item("text", close, close + 1));
            this.#brackets = opener.previous;
            return;
        }

        let matched = false;
        let reference: Link["reference"] = null;
        let label: string | null = null;
        let destination = "";
        let title: string | null = null;
        const save = this.#position;

        if (text[this.#position] === "(") {
            this.#position++;
            this.#spaces();
            const parsed = Scan.destination(text, this.#position);
            if (
                parsed &&
                (parsed[0] > this.#position || text[parsed[0]] === ")")
            ) {
                destination = parsed[1];
                this.#position = parsed[0];
                const beforeSpaces = this.#position;
                this.#spaces();
                if (this.#position > beforeSpaces) {
                    const end = Scan.title(text, this.#position);
                    if (end !== undefined) {
                        title = text.slice(this.#position, end);
                        this.#position = end;
                        this.#spaces();
                    }
                }
                if (text[this.#position] === ")") {
                    this.#position++;
                    matched = true;
                }
            }
            if (!matched) {
                this.#position = save;
                destination = "";
                title = null;
            }
        }

        if (!matched) {
            const before = this.#position;
            const length = this.#label();
            let key: string | undefined;
            if (length > 2) key = text.slice(before, before + length);
            else if (!opener.bracketAfter)
                key = `[${text.slice(opener.index, close)}]`;
            if (length === 0) this.#position = save;
            if (key && this.#labels.has(Scan.label(key))) {
                matched = true;
                label = key;
                reference =
                    length > 2
                        ? "full"
                        : length === 2
                          ? "collapsed"
                          : "shortcut";
            } else this.#position = save;
        }

        if (!matched) {
            this.#brackets = opener.previous;
            block.append(new Item("text", close, close + 1));
            return;
        }

        const link = new Item(
            opener.image ? "image" : "link",
            opener.item.start,
            this.#position,
        );
        link.tail = text.slice(close + 1, this.#position);
        link.reference = reference;
        link.label = label;
        link.destination = destination;
        link.title = title;
        let child = opener.item.next;
        while (child) {
            const next = child.next;
            link.append(child);
            child = next;
        }
        block.append(link);
        this.#processEmphasis(opener.previousDelimiter);
        this.#brackets = opener.previous;
        opener.item.unlink();
        if (!opener.image)
            for (
                let bracket = this.#brackets;
                bracket;
                bracket = bracket.previous
            )
                if (!bracket.image) bracket.active = false;
    }

    /** The length of a link label at the position, 0 when there is none. */
    #label(): number {
        const text = this.#text;
        if (text[this.#position] !== "[") return 0;
        for (let index = this.#position + 1; index < text.length; index++) {
            const char = text[index];
            if (char === "\\") index++;
            else if (char === "[") return 0;
            else if (char === "]") {
                if (index - this.#position > 1000) return 0;
                const length = index + 1 - this.#position;
                if (
                    length > 2 &&
                    !/[^ \t\n]/.test(text.slice(this.#position + 1, index))
                )
                    return 0;
                this.#position = index + 1;
                return length;
            }
        }
        return 0;
    }

    #spaces(): void {
        let newline = false;
        while (this.#position < this.#text.length) {
            const char = this.#text[this.#position];
            if (char === "\n" && !newline) newline = true;
            else if (char !== " " && char !== "\t") break;
            this.#position++;
        }
    }

    #remove(delimiter: Delimiter): void {
        if (delimiter.previous) delimiter.previous.next = delimiter.next;
        if (delimiter.next) delimiter.next.previous = delimiter.previous;
        else this.#delimiters = delimiter.previous;
    }

    #processEmphasis(bottom: Delimiter | null): void {
        const openersBottom = new Map<string, Delimiter | null>();
        let closer = this.#delimiters;
        while (closer && closer.previous !== bottom) closer = closer.previous;

        while (closer) {
            if (!closer.canClose) {
                closer = closer.next;
                continue;
            }
            const key =
                closer.char === "~"
                    ? `~${closer.count}`
                    : `${closer.char}${closer.canOpen}${closer.original % 3}`;
            const floor = openersBottom.has(key)
                ? openersBottom.get(key)
                : bottom;
            let opener = closer.previous;
            let found = false;
            while (opener && opener !== bottom && opener !== floor) {
                if (opener.char === closer.char && opener.canOpen) {
                    if (closer.char === "~") {
                        if (opener.count === closer.count) {
                            found = true;
                            break;
                        }
                    } else {
                        const odd =
                            (closer.canOpen || opener.canClose) &&
                            closer.original % 3 !== 0 &&
                            (opener.original + closer.original) % 3 === 0;
                        if (!odd) {
                            found = true;
                            break;
                        }
                    }
                }
                opener = opener.previous;
            }
            const old = closer;
            if (found && opener) {
                const use =
                    closer.char === "~"
                        ? closer.count
                        : closer.count >= 2 && opener.count >= 2
                          ? 2
                          : 1;
                const openItem = opener.item;
                const closeItem = closer.item;
                opener.count -= use;
                closer.count -= use;
                openItem.end -= use;
                closeItem.start += use;
                const emph = new Item(
                    closer.char === "~" ? "del" : use === 1 ? "emph" : "strong",
                    openItem.end,
                    closeItem.start,
                );
                emph.delimiter = closer.char.repeat(use);
                let child = openItem.next;
                while (child && child !== closeItem) {
                    const next = child.next;
                    emph.append(child);
                    child = next;
                }
                openItem.insertAfter(emph);
                // delimiters between opener and closer are text now
                let between = closer.previous;
                while (between && between !== opener) {
                    const previous = between.previous;
                    this.#remove(between);
                    between = previous;
                }
                if (opener.count === 0) {
                    openItem.unlink();
                    this.#remove(opener);
                }
                if (closer.count === 0) {
                    closeItem.unlink();
                    const next = closer.next;
                    this.#remove(closer);
                    closer = next;
                }
            } else {
                closer = closer.next;
                openersBottom.set(key, old.previous);
                if (!old.canOpen) this.#remove(old);
            }
        }
        while (this.#delimiters && this.#delimiters !== bottom)
            this.#remove(this.#delimiters);
    }

    static #convert(parent: Item, text: string): Inline[] {
        const inlines: Inline[] = [];
        for (let item = parent.first; item; item = item.next) {
            const { start, end } = item;
            const raw = text.slice(start, end);
            const previous = inlines.at(-1);
            switch (item.kind) {
                case "text":
                    if (start === end) break;
                    if (previous?.type === "Text" && previous.end === start) {
                        previous.end = end;
                        previous.raw = text.slice(previous.start, end);
                    } else inlines.push({ type: "Text", start, end, raw });
                    break;
                case "softbreak":
                case "hardbreak":
                    inlines.push({
                        type: "Break",
                        start,
                        end,
                        hard: item.kind === "hardbreak",
                        raw,
                    });
                    break;
                case "code":
                    inlines.push({ type: "Code", start, end, raw });
                    break;
                case "autolink":
                    inlines.push({ type: "Autolink", start, end, raw });
                    break;
                case "html":
                    inlines.push({ type: "Html", start, end, raw });
                    break;
                case "emph":
                case "strong":
                case "del":
                    inlines.push({
                        type:
                            item.kind === "emph"
                                ? "Emphasis"
                                : item.kind === "strong"
                                  ? "Strong"
                                  : "Strikethrough",
                        start,
                        end,
                        delimiter: item.delimiter,
                        children: Inlines.#convert(item, text),
                    });
                    break;
                case "link":
                case "image":
                    inlines.push({
                        type: item.kind === "link" ? "Link" : "Image",
                        start,
                        end,
                        children: Inlines.#convert(item, text),
                        tail: item.tail,
                        reference: item.reference,
                        label: item.label,
                        destination: item.destination,
                        title: item.title,
                    });
                    break;
            }
        }
        return inlines;
    }
}
