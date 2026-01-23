import { parse, parseExpression } from "@aljazmc/syntax";
import Layout from "../layout.js";
import Assignments from "./assignments.js";
import Calls from "./calls.js";
import Classes from "./classes.js";
import Comments from "./comments.js";
import Expressions from "./expressions.js";
import Functions from "./functions.js";
import Jsx from "./jsx.js";
import Modules from "./modules.js";
import Printer, { type Options } from "./printer.js";
import type Section from "./section.js";
import Statements from "./statements.js";
import TypeScript from "./typescript.js";

export type { Options };

const sections: (new (printer: Printer) => Section)[] = [
    Statements,
    Expressions,
    Assignments,
    Calls,
    Functions,
    Classes,
    Modules,
    TypeScript,
    Jsx,
];

/** Formats JavaScript, TypeScript, JSX and JSON source with a full printer. */
export default class JavaScript {
    readonly #options: Options;

    constructor(options: Options) {
        this.#options = options;
    }

    format(
        source: string,
        language: { typescript: boolean; jsx: boolean },
    ): string {
        const { program, comments } = this.#options.json
            ? parseExpression(source)
            : parse(source, language);
        new Comments(source).attach(program, comments);

        const printer = new Printer(source, this.#options);
        for (const section of sections) printer.section(section).register();
        const doc = printer.print(program);

        const lost = comments.find(
            (comment) => !printer.isPrinted(comment.start),
        );
        if (lost)
            throw new Error(
                `Comment would be lost: ${lost.value.slice(0, 40)}`,
            );

        return new Layout({
            lineWidth: this.#options.lineWidth,
            useTabs: this.#options.useTabs,
            indentWidth: this.#options.indentWidth,
        }).print(doc);
    }
}
