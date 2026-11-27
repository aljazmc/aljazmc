import { readFileSync } from "node:fs";
import { picture, session, svg } from "../terminal.ts";

describe("terminal", () => {
    // the picture in README.md shows what the built tools print today
    test("the picture is the session as the tools run it, draw it again when it fails", () => {
        expect(readFileSync(picture, "utf8")).toBe(svg(session()));
    });

    test("lines are escaped and coloured by kind", () => {
        const drawn = svg([
            "$ npx lintero",
            "error: a.ts:1:1 x: <b> & c",
            "formatted: a.ts",
        ]);
        expect(drawn).toContain('fill="#7ee787">$ npx lintero</text>');
        expect(drawn).toContain(
            'fill="#ff7b72">error: a.ts:1:1 x: &lt;b&gt; &amp; c</text>',
        );
        expect(drawn).toContain('fill="#79c0ff">formatted: a.ts</text>');
    });
});
