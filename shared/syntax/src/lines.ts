/**
 * Converts offsets to 1-based lines and columns. Like Biome, columns count
 * characters, so a character outside the BMP, like an emoji, is one column,
 * not the two UTF-16 code units it takes.
 */
export default class Lines {
    readonly #starts: number[] = [0];
    readonly #text: string;

    constructor(text: string) {
        this.#text = text;
        for (const match of text.matchAll(/\r\n|\r|\n/g))
            this.#starts.push(match.index + match[0].length);
    }

    line(offset: number): number {
        let low = 0;
        let high = this.#starts.length - 1;

        while (low < high) {
            const middle = Math.ceil((low + high) / 2);
            if ((this.#starts[middle] as number) <= offset) low = middle;
            else high = middle - 1;
        }

        return low + 1;
    }

    column(offset: number): number {
        const start = this.#starts[this.line(offset) - 1] as number;
        let column = 1;
        for (let index = start; index < offset; index++) {
            const code = this.#text.charCodeAt(index);
            // a surrogate pair is one character
            if (
                code >= 0xd800 &&
                code <= 0xdbff &&
                index + 1 < offset &&
                (this.#text.charCodeAt(index + 1) & 0xfc00) === 0xdc00
            )
                index++;
            column++;
        }
        return column;
    }
}
