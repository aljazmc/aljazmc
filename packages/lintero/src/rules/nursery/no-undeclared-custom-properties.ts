import type { Css } from "@aljazmc/syntax";
import { parseCss } from "@aljazmc/syntax";
import { decode, values } from "../../analysis/css.js";
import { rule } from "../../rules.js";

/** The custom properties a stylesheet declares, also with `@property`. */
function declared(sheet: Css.Stylesheet, names: Set<string>): void {
    const visit = (items: Css.Item[]) => {
        for (const item of items)
            if (item.type === "Declaration") {
                if (decode(item.property).startsWith("--"))
                    names.add(decode(item.property));
            } else if (item.type === "AtRule") {
                const name = item.prelude[0];
                if (item.keyword === "property" && name?.type === "Identifier")
                    names.add(decode(name.value));
                if (item.block) visit(item.block.children);
            } else if (item.type === "Rule") visit(item.block.children);
    };
    visit(sheet.children);
}

/** A relative path resolved against the directory of a file. */
const resolve = (file: string, target: string): string => {
    const parts = file.split("/").slice(0, -1);
    for (const part of target.split("/"))
        if (part === "..") parts.pop();
        else if (part !== "." && part !== "") parts.push(part);
    return parts.join("/");
};

export default rule({
    name: "noUndeclaredCustomProperties",
    group: "nursery",
    severity: "info",
    recommended: false,
    fix: "none",
    languages: ["css"],
    domains: { project: "all" },
    create: (context) => {
        let names: Set<string> | undefined;
        /** This file's custom properties and those of the stylesheets it imports. */
        const known = (): Set<string> => {
            if (names) return names;
            names = new Set();
            const seen = new Set<string>();
            const add = (sheet: Css.Stylesheet, file: string) => {
                declared(sheet, names as Set<string>);
                for (const item of sheet.children) {
                    if (item.type !== "AtRule" || item.keyword !== "import")
                        continue;
                    const url = item.prelude[0];
                    const target =
                        url?.type === "String"
                            ? url.raw.slice(1, -1)
                            : url?.type === "Url"
                              ? url.value?.type === "String"
                                  ? url.value.raw.slice(1, -1)
                                  : url.value?.value
                              : undefined;
                    if (!target || /^[a-z]+:/i.test(target)) continue;
                    const path = resolve(file, target);
                    if (seen.has(path)) continue;
                    seen.add(path);
                    const text = context.project.read?.(path);
                    if (text !== undefined)
                        add(parseCss(text, { recover: true }), path);
                }
            };
            add(context.css as Css.Stylesheet, context.file);
            return names;
        };
        return {
            CssDeclaration(node) {
                for (const value of values(node.value)) {
                    if (value.type !== "Function" || !/^var$/i.test(value.name))
                        continue;
                    const name = value.children[0];
                    if (
                        name?.type !== "Identifier" ||
                        !decode(name.value).startsWith("--")
                    )
                        continue;
                    if (!known().has(decode(name.value)))
                        context.report(
                            name,
                            `The custom property ${name.value} is not defined.`,
                        );
                }
            },
        };
    },
});
