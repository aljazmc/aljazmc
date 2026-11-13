import { isKeyframes } from "../../analysis/css.js";
import { rule } from "../../rules.js";

export default rule({
    name: "noDuplicateSelectorsKeyframeBlock",
    group: "suspicious",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["css"],
    create: (context) => ({
        CssAtRule(node) {
            if (!isKeyframes(node) || !node.block) return;
            const seen = new Set<string>();
            for (const item of node.block.children) {
                if (item.type !== "Rule") continue;
                const first = item.prelude[0];
                if (!first) return;
                // only the first selector of each keyframe counts
                const comma = item.prelude.findIndex(
                    (value) => value.type === "Comma",
                );
                const last =
                    item.prelude[
                        comma < 0 ? item.prelude.length - 1 : comma - 1
                    ] ?? first;
                const range = { start: first.start, end: last.end };
                const text = context.slice(range).toLowerCase();
                if (seen.has(text)) {
                    context.report(
                        range,
                        "The duplicate keyframe selector is overwritten by later one.",
                    );
                    return;
                }
                seen.add(text);
            }
        },
    }),
});
