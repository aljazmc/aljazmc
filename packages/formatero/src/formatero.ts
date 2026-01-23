import { EOL } from "node:os";
import { Includes } from "@aljazmc/config";
import { Lines, language as languageOf, ParseError } from "@aljazmc/syntax";
import JavaScript, { type Options } from "./printer/javascript/index.js";
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
        const { enabled, javascript, json } = this.#rules;
        const language = languageOf(file);
        const section = language && (language.json ? json : javascript);

        return (
            (section?.enabled ?? enabled) &&
            (file === "" || this.#includes.matches(file))
        );
    }

    /** Formats source, unchanged when the file is not formatted. */
    format(source: string, file = ""): string {
        if (!this.formats(file)) return source;

        const { javascript, json, includes, useEditorconfig, ...shared } =
            this.#rules;
        const language = languageOf(file);

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
