import { rule } from "../../rules.js";

export default rule<{ bom?: "always" | "never" }>({
    name: "useConsistentUnicodeBom",
    group: "nursery",
    severity: "info",
    recommended: false,
    fix: "safe",
    languages: ["css", "html", "md"],
    options: { bom: "never" },
    create: (context) => {
        const check = (node: { bom: boolean }) => {
            const always = context.options.bom === "always";
            if (node.bom === always) return;
            if (node.bom)
                context.report(
                    { start: 0, end: 1 },
                    "This file starts with a Unicode byte order mark (BOM).",
                    {
                        message: "Remove the Unicode byte order mark.",
                        edits: [{ start: 0, end: 1, text: "" }],
                    },
                );
            else
                context.report(
                    { start: 0, end: 0 },
                    "This file is missing a Unicode byte order mark (BOM).",
                    {
                        message: "Insert a Unicode byte order mark.",
                        edits: [{ start: 0, end: 0, text: "﻿" }],
                    },
                );
        };
        return { Root: check, HtmlRoot: check, CssStylesheet: check };
    },
});
