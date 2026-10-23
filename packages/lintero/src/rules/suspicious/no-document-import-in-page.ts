import Imports from "../../analysis/imports.js";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

/** Whether a file is Next.js's custom document, `pages/_document.jsx` or `pages/_document/index.jsx`. */
export const isDocument = (file: string): boolean => {
    const segments = Imports.segments(file);
    const stem = (segment: string | undefined) =>
        segment?.replace(/\.[^.]*$/, "");
    return (
        stem(segments.at(-1)) === "_document" || segments.at(-2) === "_document"
    );
};

export default rule({
    name: "noDocumentImportInPage",
    group: "suspicious",
    severity: "warn",
    recommended: false,
    fix: "none",
    languages: ["js"],
    domains: { next: "recommended" },
    create: (context) => ({
        ImportDeclaration(node) {
            const segments = Imports.segments(context.file);
            if (
                Nodes.string(node.source) === "next/document" &&
                segments.slice(0, -1).includes("pages") &&
                !isDocument(context.file)
            )
                context.report(
                    node,
                    "Don't use next/document outside of pages/_document.jsx to avoid unexpected behaviors.",
                );
        },
    }),
});
