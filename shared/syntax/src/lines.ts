/** Converts offsets to 1-based lines and columns. */
export default class Lines {
    readonly #starts: number[] = [0];

    constructor(text: string) {
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
        return offset - (this.#starts[this.line(offset) - 1] as number) + 1;
    }
}
