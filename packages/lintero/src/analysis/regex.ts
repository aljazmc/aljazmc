/**
 * A small parser for regular expression literals, enough for rules that look at
 * escapes, character classes, groups and backreferences. Positions are offsets
 * into the pattern, between the slashes.
 */

export interface Character {
    type: "character";
    start: number;
    end: number;
    /** The code point, or the code unit of a lone surrogate. */
    value: number;
    /** Written as an escape, like `\a` or `A`. */
    escaped: boolean;
    /** The escaped character, like `a` for `\a`. */
    raw: string;
}

/** Escapes that are not characters, like `\d`, `\b`, `\p{L}` or `\q{abc}`. */
export interface Escape {
    type: "escape";
    start: number;
    end: number;
    kind: string;
}

export interface Backreference {
    type: "backreference";
    start: number;
    end: number;
    /** The group number, or its name for `\k<name>`. */
    reference: number | string;
    parent: Group | Pattern;
}

export interface CharacterClass {
    type: "class";
    start: number;
    end: number;
    negate: boolean;
    elements: ClassElement[];
}

/** A range dash, `&&` or `--` of a character class. */
export interface Operator {
    type: "operator";
    start: number;
    end: number;
    value: "-" | "&&" | "--";
}

export type ClassElement = Character | Escape | CharacterClass | Operator;

export interface Group {
    type: "group";
    start: number;
    end: number;
    kind:
        | "capturing"
        | "group"
        | "lookahead"
        | "lookbehind"
        | "negativeLookahead"
        | "negativeLookbehind";
    /** The number of a capturing group, 1-based. */
    index?: number;
    name?: string | undefined;
    alternatives: Term[][];
    parent: Group | Pattern;
}

export interface Pattern {
    type: "pattern";
    start: number;
    end: number;
    alternatives: Term[][];
}

export type Term = Character | Escape | Backreference | CharacterClass | Group;

export interface Parsed {
    pattern: Pattern;
    groups: Group[];
    backreferences: Backreference[];
    classes: CharacterClass[];
    /** Escaped characters outside classes, like `\a` in `/\a/`. */
    escapes: Character[];
    unicode: boolean;
    unicodeSets: boolean;
}

const classEscapes = "dDsSwW";

/** Parses the pattern of a literal like `/a(b)\1/u`, undefined when invalid. */
export function parseRegex(raw: string): Parsed | undefined {
    const end = raw.lastIndexOf("/");
    const source = raw.slice(1, end);
    const flags = raw.slice(end + 1);
    try {
        return new RegexParser(source, flags).parse();
    } catch {
        return;
    }
}

class RegexParser {
    readonly #source: string;
    readonly #unicode: boolean;
    readonly #sets: boolean;
    #index = 0;
    readonly #groups: Group[] = [];
    readonly #backreferences: Backreference[] = [];
    readonly #classes: CharacterClass[] = [];
    readonly #escapes: Character[] = [];
    readonly #named: boolean;

    constructor(source: string, flags: string) {
        this.#source = source;
        this.#sets = flags.includes("v");
        this.#unicode = flags.includes("u") || this.#sets;
        this.#named = this.#unicode || /\(\?<[^=!]/.test(source);
    }

    parse(): Parsed {
        const pattern: Pattern = {
            type: "pattern",
            start: 0,
            end: this.#source.length,
            alternatives: [],
        };
        pattern.alternatives = this.#disjunction(pattern);
        if (this.#index < this.#source.length) throw new Error("unexpected )");
        return {
            pattern,
            groups: this.#groups,
            backreferences: this.#backreferences,
            classes: this.#classes,
            escapes: this.#escapes,
            unicode: this.#unicode,
            unicodeSets: this.#sets,
        };
    }

    #peek(offset = 0): string {
        return this.#source[this.#index + offset] ?? "";
    }

    #disjunction(parent: Group | Pattern): Term[][] {
        const alternatives: Term[][] = [[]];
        while (this.#index < this.#source.length && this.#peek() !== ")") {
            if (this.#peek() === "|") {
                this.#index++;
                alternatives.push([]);
                continue;
            }
            const term = this.#term(parent);
            if (term) alternatives.at(-1)?.push(term);
        }
        return alternatives;
    }

    #term(parent: Group | Pattern): Term | undefined {
        const start = this.#index;
        const char = this.#peek();
        switch (char) {
            case "(":
                return this.#group(parent);
            case "[":
                return this.#class();
            case "\\":
                return this.#escape(parent, false);
            case "^":
            case "$":
            case ".":
                this.#index++;
                return { type: "escape", start, end: this.#index, kind: char };
            case "*":
            case "+":
            case "?":
                this.#index++;
                if (this.#peek() === "?") this.#index++;
                return;
            case "{": {
                const quantifier = /^\{\d+(,\d*)?\}\??/.exec(
                    this.#source.slice(start),
                );
                if (quantifier) {
                    this.#index += quantifier[0].length;
                    return;
                }
                break;
            }
        }
        return this.#character();
    }

    #character(): Character {
        const start = this.#index;
        const value = this.#source.codePointAt(start) ?? 0;
        const length = this.#unicode && value > 0xffff ? 2 : 1;
        this.#index += length;
        const unit = length === 1 ? this.#source.charCodeAt(start) : value;
        return {
            type: "character",
            start,
            end: this.#index,
            value: unit,
            escaped: false,
            raw: this.#source.slice(start, this.#index),
        };
    }

    #group(parent: Group | Pattern): Group {
        const start = this.#index;
        this.#index++;
        let kind: Group["kind"] = "capturing";
        let name: string | undefined;
        const rest = this.#source.slice(this.#index);
        const prefix = /^\?(?:(:)|(=)|(!)|(<=)|(<!)|<([^>]+)>|[-imsx]*:)/.exec(
            rest,
        );
        if (prefix) {
            this.#index += prefix[0].length;
            if (prefix[2]) kind = "lookahead";
            else if (prefix[3]) kind = "negativeLookahead";
            else if (prefix[4]) kind = "lookbehind";
            else if (prefix[5]) kind = "negativeLookbehind";
            else if (prefix[6]) name = prefix[6];
            else kind = "group";
        }
        const group: Group = {
            type: "group",
            start,
            end: start,
            kind,
            name,
            alternatives: [],
            parent,
        };
        if (kind === "capturing") {
            this.#groups.push(group);
            group.index = this.#groups.length;
        }
        group.alternatives = this.#disjunction(group);
        if (this.#peek() !== ")") throw new Error("unterminated group");
        this.#index++;
        group.end = this.#index;
        return group;
    }

    #class(): CharacterClass {
        const start = this.#index;
        this.#index++;
        const negate = this.#peek() === "^";
        if (negate) this.#index++;
        const node: CharacterClass = {
            type: "class",
            start,
            end: start,
            negate,
            elements: [],
        };
        this.#classes.push(node);
        while (this.#peek() !== "]") {
            if (this.#index >= this.#source.length)
                throw new Error("unterminated class");
            const at = this.#index;
            if (this.#sets && this.#peek() === "[")
                node.elements.push(this.#class());
            else if (
                this.#sets &&
                (this.#source.startsWith("&&", at) ||
                    this.#source.startsWith("--", at))
            ) {
                this.#index += 2;
                node.elements.push({
                    type: "operator",
                    start: at,
                    end: this.#index,
                    value: this.#source.slice(at, at + 2) as "&&",
                });
            } else if (this.#peek() === "-") {
                this.#index++;
                node.elements.push({
                    type: "operator",
                    start: at,
                    end: this.#index,
                    value: "-",
                });
            } else if (this.#peek() === "\\")
                node.elements.push(
                    this.#escape(undefined, true) as ClassElement,
                );
            else node.elements.push(this.#character());
        }
        this.#index++;
        node.end = this.#index;
        return node;
    }

    /** An escape after `\`, in or outside of a class. */
    #escape(parent: Group | Pattern | undefined, inClass: boolean): Term {
        const start = this.#index;
        this.#index++;
        const char = this.#peek();
        const rest = this.#source.slice(this.#index);
        const done = (kind: string, length: number): Escape => {
            this.#index += length;
            return { type: "escape", start, end: this.#index, kind };
        };
        const character = (value: number, length: number): Character => {
            this.#index += length;
            const result: Character = {
                type: "character",
                start,
                end: this.#index,
                value,
                escaped: true,
                raw: this.#source.slice(start + 1, this.#index),
            };
            if (!inClass) this.#escapes.push(result);
            return result;
        };

        if (classEscapes.includes(char)) return done(char, 1);
        if (!inClass && (char === "b" || char === "B")) return done(char, 1);
        if (this.#unicode && (char === "p" || char === "P")) {
            const property = /^[pP]\{[^}]*\}/.exec(rest);
            if (property) return done("p", property[0].length);
        }
        if (this.#sets && inClass && char === "q") {
            const strings = /^q\{[^}]*\}/.exec(rest);
            if (strings) return done("q", strings[0].length);
        }
        if (!inClass && char === "k" && this.#named) {
            const name = /^k<([^>]+)>/.exec(rest);
            if (name?.[1]) {
                this.#index += name[0].length;
                const reference: Backreference = {
                    type: "backreference",
                    start,
                    end: this.#index,
                    reference: name[1],
                    parent: parent as Group,
                };
                this.#backreferences.push(reference);
                return reference;
            }
        }
        if (!inClass && /[1-9]/.test(char)) {
            const digits = /^\d+/.exec(rest)?.[0] ?? char;
            this.#index += digits.length;
            const reference: Backreference = {
                type: "backreference",
                start,
                end: this.#index,
                reference: Number(digits),
                parent: parent as Group,
            };
            this.#backreferences.push(reference);
            return reference;
        }
        const simple: Record<string, number> = {
            f: 12,
            n: 10,
            r: 13,
            t: 9,
            v: 11,
            b: 8,
        };
        if (simple[char] !== undefined)
            return character(simple[char] as number, 1);
        if (char === "0" && !/\d/.test(rest[1] ?? "")) return character(0, 1);
        if (char === "c" && /[a-z]/i.test(rest[1] ?? ""))
            return character((rest.charCodeAt(1) ?? 0) % 32, 2);
        const hex = /^x([0-9a-fA-F]{2})/.exec(rest);
        if (hex?.[1]) return character(Number.parseInt(hex[1], 16), 3);
        const braced = this.#unicode ? /^u\{([0-9a-fA-F]+)\}/.exec(rest) : null;
        if (braced?.[1])
            return character(Number.parseInt(braced[1], 16), braced[0].length);
        const unit = /^u([0-9a-fA-F]{4})/.exec(rest);
        if (unit?.[1]) {
            const high = Number.parseInt(unit[1], 16);
            const low = this.#unicode
                ? /^u([0-9a-fA-F]{4})\\u([0-9a-fA-F]{4})/.exec(rest)
                : null;
            const second = low?.[2] ? Number.parseInt(low[2], 16) : 0;
            // a surrogate pair is one code point in unicode mode
            if (
                high >= 0xd800 &&
                high <= 0xdbff &&
                second >= 0xdc00 &&
                second <= 0xdfff
            )
                return character(
                    (high - 0xd800) * 0x400 + (second - 0xdc00) + 0x10000,
                    11,
                );
            return character(high, 5);
        }
        if (/\d/.test(char)) {
            const octal = /^[0-7]{1,3}/.exec(rest)?.[0] ?? char;
            return character(
                Number.parseInt(octal, 8) || char.charCodeAt(0),
                octal.length,
            );
        }
        const value = this.#source.codePointAt(this.#index) ?? 0;
        return character(value, this.#unicode && value > 0xffff ? 2 : 1);
    }
}
