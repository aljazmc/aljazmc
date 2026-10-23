import Imports from "../../analysis/imports.js";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";
import { isDocument } from "./no-document-import-in-page.js";

export default rule({
    name: "noHeadImportInDocument",
    group: "suspicious",
    severity: "warn",
    recommended: false,
    fix: "none",
    languages: ["js"],
    domains: { next: "recommended" },
    create: (context) => ({
        ImportDeclaration(node) {
            const segments = Imports.segments(context.file);
            const pages = segments.lastIndexOf("pages");
            if (
                Nodes.string(node.source) !== "next/head" ||
                pages < 0 ||
                pages === segments.length - 1 ||
                !isDocument(context.file)
            )
                return;
            context.report(
                node,
                `Don't use next/head in ${segments.slice(pages).join("/")}`,
            );
        },
    }),
});
