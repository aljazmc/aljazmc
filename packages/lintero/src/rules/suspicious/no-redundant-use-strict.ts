import type { Node } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

const isUseStrict = (node: Node): boolean =>
    node.type === "Directive" && node.value.raw.slice(1, -1) === "use strict";

/** Whether a program or function body starts with "use strict". */
const strict = (node: Node): boolean =>
    (node.type === "Program" || node.type === "BlockStatement") &&
    node.directives.some(isUseStrict);

export default rule({
    name: "noRedundantUseStrict",
    group: "suspicious",
    severity: "warn",
    recommended: true,
    fix: "safe",
    languages: ["js"],
    create: (context) => {
        // like Biome, everything is a module but CommonJS scripts
        const script =
            /\.cjs$/.test(context.file) ||
            (/\.jsx?$/.test(context.file) &&
                context.manifest.type === "commonjs");
        return {
            Directive(node) {
                if (!isUseStrict(node)) return;
                const body = context.parent(node);
                const redundant =
                    !script ||
                    (body !== undefined &&
                        (body.type === "Program" ||
                            body.type === "BlockStatement") &&
                        body.directives
                            .slice(0, body.directives.indexOf(node))
                            .some(isUseStrict)) ||
                    [...context.ancestors(node)].some(
                        (ancestor) =>
                            ancestor.type === "ClassBody" ||
                            (ancestor !== body && strict(ancestor)),
                    );
                if (redundant)
                    context.report(node, "Redundant use strict directive.", {
                        message: "Remove the redundant use strict directive.",
                        edits: [{ start: node.start, end: node.end, text: "" }],
                    });
            },
        };
    },
});
