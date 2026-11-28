import {
    duration,
    median,
    replace,
    rows,
    size,
    table,
    tools,
    wrap,
} from "../benchmark.ts";

describe("benchmark", () => {
    test("the other tools are pinned to exact versions", () => {
        for (const [name, packages] of Object.entries(tools))
            for (const spec of packages)
                if (!spec.startsWith("@aljazmc/"))
                    expect(`${name}: ${spec}`).toMatch(/@\d+\.\d+\.\d+$/);
    });

    test("the median of odd and even counts, unsorted", () => {
        expect(median([3, 1, 2])).toBe(2);
        expect(median([4, 1, 3, 2])).toBe(2.5);
        expect(median([])).toBeNaN();
    });

    test("times and sizes read as people write them", () => {
        expect(duration(183.4)).toBe("183 ms");
        expect(duration(1720)).toBe("1.72 s");
        expect(size(900)).toBe("900 kB");
        expect(size(1434)).toBe("1.4 MB");
    });

    test("tables have their columns padded", () => {
        expect(table(["A", "Bb"], [["xxxx", "y"]])).toBe(
            ["| A    | Bb  |", "| ---- | --- |", "| xxxx | y   |"].join("\n"),
        );
    });

    test("rows put ours first, in bold, the others relative to it", () => {
        const run = (tool: string, times: number[], found?: number) => ({
            tool,
            times,
            found,
            packages: 3,
            size: 2048,
        });
        expect(
            rows(
                [run("ours", [100, 200, 300], 0), run("other", [400], 5)],
                "files",
            ),
        ).toEqual([
            ["**ours**", "200 ms", "1.0×", "0 files", "3", "2.0 MB"],
            ["other", "400 ms", "2.0×", "5 files", "3", "2.0 MB"],
        ]);
        expect(rows([run("ours", [1])], "x")[0]?.[3]).toBe("n/a");
    });

    test("paragraphs wrap at 80 columns, words whole", () => {
        const text = wrap(`${"word ".repeat(40)}end`);
        for (const line of text.split("\n"))
            expect(line.length).toBeLessThanOrEqual(80);
        expect(text.replace(/\n/g, " ")).toBe(`${"word ".repeat(40)}end`);
    });

    test("only what is between the markers is replaced", () => {
        const text =
            "a\n<!-- benchmark:start -->\nold\n<!-- benchmark:end -->\nb\n";
        expect(replace(text, "new")).toBe(
            "a\n<!-- benchmark:start -->\n\nnew\n\n<!-- benchmark:end -->\nb\n",
        );
        expect(() => replace("no markers", "new")).toThrow(
            "No benchmark markers",
        );
    });
});
