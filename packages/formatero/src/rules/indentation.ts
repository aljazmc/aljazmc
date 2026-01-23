import type { Rule, Shared } from "../rules.js";
import Code from "../tokens/code.js";
import type { Token } from "../tokens/token.js";

interface Level {
    open?: Token;
    /** Level of the line that opened the bracket. */
    level: number;
    line: number;
    /** Level of statements inside, one deeper unless content hugs the bracket. */
    indent: number;
    /** Level of the current statement's first line inside the bracket. */
    base: number;
    /** Level of the last line that a member chain (`.call()`) continues. */
    chain: number;
    /** Whether content starts on the opening line, like `(a &&`. */
    hugs: boolean;
    /** Whether operator continuations stay at the base level. */
    flat: boolean;
}

interface Line {
    head: Token;
    last: Token;
    level: number;
    line: number;
}

/**
 * Indents code by its bracket structure, ignoring existing whitespace,
 * so mixed tabs and spaces cannot mislead it.
 */
export default class Indentation implements Rule {
    /** Line start tokens that continue the previous line. */
    static readonly #leading = new Set([
        "!=",
        "!==",
        "%",
        "&",
        "&&",
        "*",
        "**",
        "+",
        "-",
        ".",
        "/",
        ":",
        "<",
        "<=",
        "==",
        "===",
        "=>",
        ">",
        ">=",
        "?",
        "?.",
        "??",
        "^",
        "|",
        "||",
        "as",
        "extends",
        "implements",
        "in",
        "instanceof",
        "satisfies",
    ]);

    /** Line end tokens that make the next line a continuation. */
    static readonly #trailing = new Set([
        "!=",
        "!==",
        "%",
        "%=",
        "&",
        "&&",
        "&&=",
        "&=",
        "*",
        "**",
        "**=",
        "*=",
        "+",
        "+=",
        "-",
        "-=",
        "/",
        "/=",
        "<<=",
        "<=",
        "=",
        "==",
        "===",
        "=>",
        ">=",
        "?",
        "??",
        "??=",
        "^",
        "^=",
        "|",
        "|=",
        "||",
        "||=",
    ]);

    /** Line end tokens after which a leading operator starts anew. */
    static readonly #separators = new Set([",", ";", "{", "}", "(", "["]);

    readonly #unit: string;

    constructor({
        indentStyle,
        indentWidth,
    }: Pick<Shared, "indentStyle" | "indentWidth">) {
        this.#unit = indentStyle === "tab" ? "\t" : " ".repeat(indentWidth);
    }

    apply(code: Code): void {
        const { tokens } = code;
        const stack: Level[] = [
            {
                level: -1,
                line: -1,
                indent: 0,
                base: 0,
                chain: 0,
                hugs: false,
                flat: false,
            },
        ];
        let previous: Line | undefined;

        for (let start = 0, line = 0; start <= tokens.length; line++) {
            let end = start;
            while (end < tokens.length && tokens[end]?.kind !== "newline")
                end++;

            if (tokens[start]?.kind !== "space") {
                tokens.splice(start, 0, { kind: "space", value: "" });
                end++;
            }

            const indent = tokens[start] as Token;
            const first = start + 1;
            const head = tokens[first];
            start = end + 1;

            if (first === end || !head) {
                indent.value = "";
                continue;
            }

            let leading = first;
            let popped: Level | undefined;
            while (leading < end && this.#closes(tokens[leading], stack)) {
                popped = this.#pop(stack, tokens[leading] as Token);
                leading++;
                if (tokens[leading]?.kind === "space") leading++;
            }

            const top = stack.at(-1) as Level;
            const level = popped?.level ?? this.#level(top, head, previous);
            if (popped?.line === top.line) top.base = level;
            if (!popped && !Indentation.#member(head)) top.chain = level;
            indent.value = this.#unit.repeat(level);

            let current = level;
            let last: Token | undefined;
            for (let index = first; index < end; index++) {
                const token = tokens[index] as Token;

                if (index >= leading && this.#closes(token, stack))
                    current = this.#pop(stack, token).level;
                if (Code.opens(token) || this.#angle(code, index)) {
                    const group = ["group", "header"].includes(
                        token.bracket ?? "",
                    );
                    const hugs = group && code.seek(index, 1) < end;
                    const inner = hugs ? current : current + 1;
                    stack.push({
                        open: token,
                        level: current,
                        line,
                        indent: inner,
                        base: inner,
                        chain: inner,
                        hugs,
                        flat: group && (!hugs || this.#ternary(code, token)),
                    });
                }
                if (token.kind === "comment" && /[\r\n]/.test(token.value))
                    token.value = this.#comment(token.value, indent.value);
                if (Code.significant(token)) last = token;
            }

            if (last) previous = { head, last, level, line };
        }
    }

    /** Closing brackets, including `>` of a type argument list. */
    #closes(token: Token | undefined, stack: Level[]): boolean {
        if (!token || stack.length < 2) return false;
        if (token.kind === "punct" && token.value === ">")
            return Indentation.#isAngle(stack.at(-1));
        return Code.closes(token);
    }

    /** Pops the bracket closed by token, dropping unclosed `<` above it. */
    #pop(stack: Level[], token: Token): Level {
        while (token.value !== ">" && Indentation.#isAngle(stack.at(-1)))
            stack.pop();
        return stack.pop() as Level;
    }

    static #isAngle(level?: Level): boolean {
        return level?.open?.kind === "punct" && level.open.value === "<";
    }

    /** Whether the token at index opens a type argument list. */
    #angle(code: Code, index: number): boolean {
        const token = code.tokens[index];
        return (
            token?.kind === "punct" &&
            token.value === "<" &&
            code.tokens[index - 1]?.kind === "word"
        );
    }

    /** Whether a ternary operator is directly inside the bracket. */
    #ternary(code: Code, open: Token): boolean {
        return code.tokens.some(
            (token) =>
                token.parent === open &&
                token.kind === "punct" &&
                token.value === "?",
        );
    }

    static #member(head: Token): boolean {
        return head.kind === "punct" && [".", "?."].includes(head.value);
    }

    #level(top: Level, head: Token, previous?: Line): number {
        const statement =
            top.indent +
            (top.open?.bracket === "switch" &&
            !["case", "default"].includes(head.value)
                ? 1
                : 0);

        if (!previous || (top.line === previous.line && !top.hugs)) {
            top.base = statement;
            return statement;
        }

        if (this.#body(previous.last) && head.value !== "{") {
            top.base = previous.level + 1;
            return top.base;
        }

        if (Indentation.#member(head)) return top.chain + 1;

        if (head.kind === "punct" && ["?", ":"].includes(head.value))
            return top.base + 1;

        if (this.#continues(head, previous.last, top))
            return top.flat ? top.base : top.base + 1;

        top.base = statement;
        return statement;
    }

    /** Whether the next line is the body of a braceless statement. */
    #body(last: Token): boolean {
        return (
            (last.kind === "word" && ["do", "else"].includes(last.value)) ||
            (last.value === ")" && last.open?.bracket === "header")
        );
    }

    #continues(head: Token, last: Token, top: Level): boolean {
        if (
            last.value === "," &&
            (!top.open ||
                ["arrow", "block", "switch"].includes(top.open.bracket ?? ""))
        )
            return true;

        if (
            ["punct", "word"].includes(last.kind) &&
            Indentation.#trailing.has(last.value)
        )
            return true;

        return (
            ["punct", "word"].includes(head.kind) &&
            head.parent?.bracket !== "tag" &&
            Indentation.#leading.has(head.value) &&
            !Indentation.#separators.has(last.value)
        );
    }

    /** Aligns the lines of a block comment, keeping a space before `*`. */
    #comment(value: string, indent: string): string {
        return value.replace(
            /(\r\n|\r|\n)[ \t]*(?=[^ \t\r\n])(\*?)/g,
            (_, newline: string, star: string) =>
                newline + indent + (star ? " *" : ""),
        );
    }
}
