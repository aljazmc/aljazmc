import type { Node } from "@aljazmc/syntax";
import type { Doc } from "../doc.js";
import type { Args, Options, default as Printer } from "./printer.js";

/** A group of node printers sharing the printer state. */
export default abstract class Section {
    protected readonly printer: Printer;

    constructor(printer: Printer) {
        this.printer = printer;
    }

    /** Registers the section's node printers. */
    register(): void {}

    protected get options(): Options {
        return this.printer.options;
    }

    protected print(node: Node | null | undefined, args: Args = {}): Doc {
        return this.printer.print(node, args);
    }
}
