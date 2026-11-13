import type { Html } from "@aljazmc/syntax";
import table from "../../analysis/table.js";
import { rule } from "../../rules.js";

/** Obsolete attributes and the elements they are obsolete on, `*` for all. */
const obsolete: Record<string, string[]> = table({
    abbr: ["td"],
    accept: ["form"],
    align: [
        "caption",
        "col",
        "div",
        "embed",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "hr",
        "iframe",
        "input",
        "img",
        "legend",
        "object",
        "p",
        "table",
        "tbody",
        "thead",
        "tfoot",
        "td",
        "th",
        "tr",
    ],
    alink: ["body"],
    allowtransparency: ["iframe"],
    archive: ["object"],
    axis: ["td", "th"],
    background: ["body", "table", "thead", "tbody", "tfoot", "tr", "td", "th"],
    bgcolor: ["body", "table", "td", "th", "tr"],
    border: ["input", "img", "object", "table"],
    bordercolor: ["table"],
    bottommargin: ["body"],
    cellpadding: ["table"],
    cellspacing: ["table"],
    char: ["col", "tbody", "thead", "tfoot", "td", "th", "tr"],
    charoff: ["col", "tbody", "thead", "tfoot", "td", "th", "tr"],
    charset: ["a", "link", "script"],
    classid: ["object"],
    clear: ["br"],
    code: ["object"],
    codebase: ["object"],
    codetype: ["object"],
    color: ["hr"],
    compact: ["dl", "menu", "ol", "ul"],
    contextmenu: ["*"],
    coords: ["a"],
    datafld: [
        "a",
        "button",
        "div",
        "fieldset",
        "frame",
        "iframe",
        "img",
        "input",
        "label",
        "legend",
        "marquee",
        "object",
        "select",
        "span",
        "textarea",
    ],
    dataformatas: [
        "button",
        "div",
        "input",
        "label",
        "legend",
        "marquee",
        "object",
        "option",
        "select",
        "span",
        "table",
    ],
    datapagesize: ["table"],
    datasrc: [
        "a",
        "button",
        "div",
        "frame",
        "iframe",
        "img",
        "input",
        "label",
        "legend",
        "marquee",
        "object",
        "option",
        "select",
        "span",
        "table",
        "textarea",
    ],
    declare: ["object"],
    dropzone: ["*"],
    event: ["script"],
    for: ["script"],
    frame: ["table"],
    frameborder: ["iframe"],
    framespacing: ["iframe"],
    height: ["table", "thead", "tbody", "tfoot", "td", "th", "tr"],
    hreflang: ["area"],
    hspace: ["embed", "iframe", "input", "img", "object"],
    ismap: ["input"],
    label: ["menu"],
    language: ["script"],
    leftmargin: ["body"],
    link: ["body"],
    longdesc: ["iframe", "img"],
    lowsrc: ["img"],
    manifest: ["html"],
    marginheight: ["body", "iframe"],
    marginwidth: ["body", "iframe"],
    methods: ["a", "link"],
    name: ["a", "embed", "img", "option"],
    nohref: ["area"],
    noshade: ["hr"],
    nowrap: ["td", "th"],
    onshow: ["*"],
    profile: ["head"],
    rev: ["a", "link"],
    rightmargin: ["body"],
    rules: ["table"],
    scheme: ["meta"],
    scope: ["td"],
    scrolling: ["iframe"],
    shape: ["a"],
    size: ["hr"],
    standby: ["object"],
    summary: ["table"],
    target: ["link"],
    text: ["body"],
    topmargin: ["body"],
    type: ["area", "li", "ul", "menu", "style"],
    typemustmatch: ["object"],
    urn: ["a", "link"],
    usemap: ["input", "object"],
    valign: ["col", "tbody", "thead", "tfoot", "td", "th", "tr"],
    version: ["html"],
    vlink: ["body"],
    vspace: ["embed", "iframe", "input", "img", "object"],
    width: ["col", "hr", "pre", "table", "td", "th"],
});

export default rule({
    name: "noObsoleteAttributes",
    group: "nursery",
    severity: "warn",
    recommended: true,
    fix: "none",
    languages: ["html"],
    create: (context) => {
        /** Whether an element is in an SVG image: its closest `<svg>` or `<foreignObject>` is an `<svg>`. */
        const inSvg = (node: Html.Element): boolean => {
            for (const ancestor of context.htmlAncestors(node))
                if (ancestor.tag === "svg" || ancestor.tag === "foreignObject")
                    return ancestor.tag === "svg";
            return false;
        };
        return {
            HtmlElement(node) {
                const tag = node.tag;
                for (const attribute of node.attributes) {
                    const elements = obsolete[attribute.name.toLowerCase()];
                    if (
                        !elements ||
                        !(
                            elements.includes("*") ||
                            (tag !== null && elements.includes(tag))
                        )
                    )
                        continue;
                    if (inSvg(node)) return;
                    context.report(
                        attribute,
                        `The ${attribute.name} attribute on <${node.name}> is obsolete.`,
                    );
                }
            },
        };
    },
});
