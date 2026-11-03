import type { Css } from "@aljazmc/syntax";
import { compounds, declarations } from "../../analysis/css.js";
import { rule } from "../../rules.js";

/** Properties whose values name things, where `--a` is an identifier, not a variable. */
const ignored = new Set(
    "animation animation-name container-name counter-increment counter-reset counter-set grid-column grid-column-end grid-column-start grid-row grid-row-end grid-row-start list-style list-style-type transition transition-property view-transition-name will-change".split(
        " ",
    ),
);

/** Dashed identifiers not wrapped in `var()`, the closest function decides. */
function* unwrapped(
    list: readonly Css.Value[],
    inVar = false,
): Generator<Css.Identifier> {
    for (const value of list) {
        if (
            value.type === "Identifier" &&
            value.value.startsWith("--") &&
            !inVar
        )
            yield value;
        else if (value.type === "Function") {
            // in `if()` the values of branches are not in a function
            if (/^if$/i.test(value.name))
                yield* unwrapped(value.children, false);
            else yield* unwrapped(value.children, value.name.startsWith("var"));
        } else if (value.type === "SimpleBlock")
            yield* unwrapped(value.children, inVar);
    }
}

export default rule({
    name: "noMissingVarFunction",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["css"],
    create: (context) => {
        let globals: Set<string> | undefined;
        /** Custom properties of `:root` rules and `@property`, known everywhere. */
        const global = (sheet: Css.Stylesheet): Set<string> => {
            const names = new Set<string>();
            const visit = (items: Css.Item[]) => {
                for (const item of items) {
                    if (item.type === "AtRule") {
                        if (item.keyword === "property") {
                            const name = item.prelude[0];
                            if (name?.type === "Identifier")
                                names.add(name.value);
                        }
                        if (item.block) visit(item.block.children);
                    } else if (item.type === "Rule") {
                        const root =
                            item.selectors !== null &&
                            [...compounds(item.selectors)].some(
                                ({ compound }) =>
                                    compound.children.some(
                                        (child) =>
                                            child.type ===
                                                "PseudoClassSelector" &&
                                            child.name.toLowerCase() === "root",
                                    ),
                            );
                        if (root)
                            for (const declaration of declarations(item.block))
                                if (declaration.property.startsWith("--"))
                                    names.add(declaration.property);
                        visit(item.block.children);
                    }
                }
            };
            visit(sheet.children);
            return names;
        };
        return {
            CssDeclaration(node) {
                if (ignored.has(node.property)) return;
                const candidates = [...unwrapped(node.value)];
                if (candidates.length === 0) return;
                globals ??= global(context.css as Css.Stylesheet);
                const declared = new Set<string>();
                const parent = context.cssParent(node);
                const blocks: (Css.Block | null)[] = [];
                if (parent && parent.type !== "Stylesheet")
                    blocks.push(parent.block);
                for (const ancestor of context.cssAncestors(node))
                    blocks.push(ancestor.block);
                for (const block of blocks)
                    for (const declaration of declarations(block))
                        declared.add(declaration.property);
                for (const identifier of candidates)
                    if (
                        declared.has(identifier.value) ||
                        globals.has(identifier.value)
                    )
                        context.report(
                            identifier,
                            `CSS variables '${identifier.value}' is used without the 'var()' function`,
                        );
            },
        };
    },
});
