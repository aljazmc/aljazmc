import { EOL } from "node:os";
import { Includes } from "@aljazmc/config";
import {
    isMarkdown,
    Lines,
    language as languageOf,
    ParseError,
    parse,
} from "@aljazmc/syntax";
import JavaScript, { type Options } from "./printer/javascript/index.js";
import Markdown from "./printer/markdown.js";
import ArrowParentheses from "./rules/arrow-parentheses.js";
import Indentation from "./rules/indentation.js";
import QuoteProperties from "./rules/quote-properties.js";
import Quotes from "./rules/quotes.js";
import Semicolons from "./rules/semicolons.js";
import Spacing from "./rules/spacing.js";
import TextIndentation from "./rules/text-indentation.js";
import TrailingCommas from "./rules/trailing-commas.js";
import type { Javascript, Json, Rule, Rules, Shared } from "./rules.js";
import Code from "./tokens/code.js";

/** JSON has no JavaScript only rules, these keep the printer neutral. */
const jsonDefaults = {
    arrowParentheses: "always",
    attributePosition: "auto",
    bracketSameLine: false,
    jsxQuoteStyle: "double",
    operatorLinebreak: "after",
    quoteProperties: "preserve",
    quoteStyle: "double",
    semicolons: "asNeeded",
} as const;

/** A file that cannot be formatted, like one with syntax errors. */
export class FormatError extends Error {}

export default class Formatero {
    static readonly #endings = { auto: EOL, cr: "\r", crlf: "\r\n", lf: "\n" };

    readonly #rules: Rules;
    readonly #includes: Includes;

    constructor(rules: Rules) {
        this.#rules = rules;
        this.#includes = new Includes(rules.includes);
    }

    /** Whether the rules format a file at all, its language may be disabled. */
    formats(file: string): boolean {
        return (
            this.#enabled(file) && (file === "" || this.#includes.matches(file))
        );
    }

    #enabled(file: string): boolean {
        const { enabled, javascript, json, markdown } = this.#rules;
        const language = languageOf(file);
        const section = isMarkdown(file)
            ? markdown
            : language && (language.json ? json : javascript);
        return section?.enabled ?? enabled;
    }

    /** Formats source, unchanged when the file is not formatted. */
    format(source: string, file = ""): string {
        if (!this.formats(file)) return source;
        return this.#format(source, file);
    }

    #format(source: string, file: string): string {
        const {
            javascript,
            json,
            markdown,
            includes,
            useEditorconfig,
            ...shared
        } = this.#rules;
        const language = languageOf(file);

        if (isMarkdown(file)) {
            const rules = { ...shared, ...markdown };
            const printed = new Markdown({
                lineWidth: rules.lineWidth,
                indent:
                    rules.indentStyle === "tab"
                        ? "\t"
                        : " ".repeat(rules.indentWidth),
                proseWrap: rules.proseWrap,
                ...(rules.formatEmbeds && {
                    embed: (code: string, info: string) =>
                        this.#embed(code, info),
                }),
            }).format(source);
            return this.#finish(printed, rules);
        }

        if (language && !language.json) {
            const rules = { ...shared, ...javascript };
            return this.#print(
                source,
                rules,
                language,
                Formatero.#options(rules, false, language),
                () =>
                    this.#code(new Code(source, { jsx: language.jsx }), rules, [
                        new Quotes(rules),
                        new QuoteProperties(rules),
                        new Spacing(rules),
                        new ArrowParentheses(rules),
                        new TrailingCommas(rules),
                        new Semicolons(rules),
                        new Indentation(rules),
                    ]),
            );
        }

        if (language?.json) {
            const rules = { ...shared, ...json };
            // strict JSON forbids trailing commas, only JSONC may have them
            if (file.endsWith(".json")) rules.trailingCommas = "none";
            // like npm, Biome always expands package.json
            if (/(?:^|\/)package\.json$/.test(file) && rules.expand === "auto")
                rules.expand = "always";
            const options = Formatero.#options(
                { ...rules, ...jsonDefaults },
                true,
                { typescript: false, jsx: false },
            );
            return this.#print(
                source,
                rules,
                { typescript: false, jsx: false },
                options,
                () =>
                    this.#code(new Code(source, { json: true }), rules, [
                        new Spacing(rules),
                        new TrailingCommas(rules),
                        new Indentation(rules),
                    ]),
            );
        }

        return this.#lineEndings(
            new TextIndentation(shared).format(source),
            shared,
        );
    }

    /**
     * Formats the code of a fenced block like a file of its language, like
     * Biome, it stays as written when it has errors or is in another language.
     */
    #embed(code: string, info: string): string | undefined {
        const file = Formatero.#embedded(info);
        if (!file || !this.#enabled(file)) return;
        // a hashbang starts a file, not a block
        if (code.startsWith("#!") && !isMarkdown(file)) return;
        // like Biome, `js` is JavaScript without JSX
        if (/^embed\.c?js$/.test(file))
            try {
                parse(code, { typescript: false, jsx: false });
            } catch (error) {
                if (error instanceof ParseError) return;
                throw error;
            }
        try {
            // the language's own line endings and final newline do not apply in Markdown
            return new Formatero({ ...this.#rules, formatWithErrors: false })
                .#format(code, file)
                .replace(/\r\n?/g, "\n")
                .replace(/\n+$/, "");
        } catch (error) {
            if (error instanceof FormatError) return;
            throw error;
        }
    }

    /** A file name for the language of an info string, like Biome reads it. */
    static #embedded(info: string): string | undefined {
        const language = info.split(/\s/)[0]?.toLowerCase() ?? "";
        if (/^m?js$/.test(language)) return "embed.js";
        if (/^(?:jsx|javascript|javascriptreact)$/.test(language))
            return "embed.jsx";
        if (language === "cjs") return "embed.cjs";
        if (/^(?:ts|typescript|d\.ts)$/.test(language)) return "embed.ts";
        if (/^(?:mts|cts|d\.mts|d\.cts)$/.test(language)) return "embed.mts";
        if (/^(?:tsx|typescriptreact)$/.test(language)) return "embed.tsx";
        if (/^(?:json|jsonld|webapp|webmanifest)$/.test(language))
            return "embed.json";
        if (
            /^(?:jsonc|snippets|code-snippets|code-workspace|sublime[-_]\w+)$/.test(
                language,
            )
        )
            return "embed.jsonc";
        if (/^(?:md|markdown)$/.test(language)) return "embed.md";
    }

    static #options(
        rules: Javascript | (Json & typeof jsonDefaults),
        json: boolean,
        { typescript, jsx }: { typescript: boolean; jsx: boolean },
    ): Options {
        return {
            json,
            typescript,
            jsx,
            quote: rules.quoteStyle === "single" ? "'" : '"',
            jsxQuote: rules.jsxQuoteStyle === "single" ? "'" : '"',
            quoteProperties: rules.quoteProperties,
            semicolons: rules.semicolons === "always",
            trailingCommas: rules.trailingCommas,
            arrowParentheses: rules.arrowParentheses,
            bracketSpacing: rules.bracketSpacing,
            delimiterSpacing: rules.delimiterSpacing,
            bracketSameLine: rules.bracketSameLine,
            attributePosition: rules.attributePosition,
            expand: rules.expand,
            operatorLinebreak: rules.operatorLinebreak,
            indentWidth: rules.indentWidth,
            lineWidth: rules.lineWidth,
            useTabs: rules.indentStyle === "tab",
        };
    }

    /** Prints with the full printer, or the token rules when it cannot. */
    #print(
        source: string,
        shared: Shared,
        language: { typescript: boolean; jsx: boolean },
        options: Options,
        fallback: () => string,
    ): string {
        try {
            const printed = new JavaScript(options).format(source, language);
            return this.#finish(printed, shared);
        } catch (error) {
            if (
                !(error instanceof ParseError) &&
                !(
                    error instanceof Error &&
                    error.message.startsWith("Comment would be lost")
                )
            )
                throw error;
            if (shared.formatWithErrors) return fallback();
            if (!(error instanceof ParseError))
                throw new FormatError(error.message);
            const lines = new Lines(source);
            const { position } = error;
            throw new FormatError(
                `${lines.line(position)}:${lines.column(position)} ${error.message}`,
            );
        }
    }

    #code(code: Code, shared: Shared, rules: Rule[]): string {
        for (const rule of rules) rule.apply(code);
        return this.#finish(code.toString(), shared);
    }

    #finish(text: string, shared: Shared): string {
        const source = text.replace(/(?:\r\n|\r|\n)*$/, "");
        const newline = shared.trailingNewline && source ? "\n" : "";
        return this.#lineEndings(source + newline, shared);
    }

    #lineEndings(source: string, { lineEnding }: Shared): string {
        return source.replace(/\r\n|\r|\n/g, Formatero.#endings[lineEnding]);
    }
}
