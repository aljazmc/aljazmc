import type { Node, NodeOf } from "@aljazmc/syntax";
import Jsx from "./jsx.js";

type Element = NodeOf<"JSXElement">;
type Attribute = NodeOf<"JSXAttribute">;

/** Kinds of values ARIA attributes take. */
export type ValueType =
    | {
          type:
              | "string"
              | "idref"
              | "idrefs"
              | "boolean"
              | "tristate"
              | "optional"
              | "integer"
              | "number";
      }
    | { type: "token" | "tokens"; values: string[] };

/** ARIA attributes Biome knows, without the `aria-` prefix, and their values. */
export const properties: Record<string, ValueType> = {
    activedescendant: { type: "idref" },
    atomic: { type: "boolean" },
    autocomplete: { type: "token", values: ["list", "inline", "both", "none"] },
    braillelabel: { type: "string" },
    brailleroledescription: { type: "string" },
    busy: { type: "boolean" },
    checked: { type: "tristate" },
    colcount: { type: "integer" },
    colindex: { type: "integer" },
    colindextext: { type: "string" },
    colspan: { type: "integer" },
    controls: { type: "idrefs" },
    current: {
        type: "token",
        values: ["true", "false", "page", "step", "location", "date", "time"],
    },
    describedby: { type: "idrefs" },
    description: { type: "string" },
    details: { type: "idrefs" },
    disabled: { type: "boolean" },
    dropeffect: {
        type: "tokens",
        values: ["none", "copy", "move", "link", "execute", "popup"],
    },
    errormessage: { type: "idrefs" },
    expanded: { type: "optional" },
    flowto: { type: "idrefs" },
    grabbed: { type: "optional" },
    haspopup: {
        type: "token",
        values: ["true", "false", "grid", "menu", "dialog", "tree", "listbox"],
    },
    hidden: { type: "optional" },
    invalid: {
        type: "token",
        values: ["true", "false", "spelling", "grammar"],
    },
    keyshortcuts: { type: "string" },
    label: { type: "string" },
    labelledby: { type: "idrefs" },
    level: { type: "integer" },
    live: { type: "token", values: ["polite", "off", "assertive"] },
    modal: { type: "boolean" },
    multiline: { type: "boolean" },
    multiselectable: { type: "boolean" },
    orientation: {
        type: "token",
        values: ["undefined", "horizontal", "vertical"],
    },
    owns: { type: "idrefs" },
    placeholder: { type: "string" },
    posinset: { type: "integer" },
    pressed: { type: "tristate" },
    readonly: { type: "boolean" },
    relevant: {
        type: "tokens",
        values: ["additions", "removals", "text", "all"],
    },
    required: { type: "boolean" },
    roledescription: { type: "string" },
    rowcount: { type: "integer" },
    rowindex: { type: "integer" },
    rowindextext: { type: "string" },
    rowspan: { type: "integer" },
    selected: { type: "optional" },
    setsize: { type: "integer" },
    sort: {
        type: "token",
        values: ["ascending", "none", "other", "descending"],
    },
    valuemax: { type: "number" },
    valuemin: { type: "number" },
    valuenow: { type: "number" },
    valuetext: { type: "string" },
};

/** Attributes every role supports. */
export const globalProperties = new Set(
    `
        atomic busy controls current describedby description details
        disabled dropeffect errormessage flowto grabbed haspopup
        hidden invalid keyshortcuts live owns relevant
    `
        .trim()
        .split(/\s+/),
);

/** Valid, non-abstract roles, with the attributes they support besides the global ones, and those they require. */
const definitions: Record<string, [string, string]> = {
    alert: [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    alertdialog: [
        "braillelabel brailleroledescription label labelledby modal roledescription",
        "",
    ],
    application: [
        "activedescendant braillelabel brailleroledescription expanded label labelledby roledescription",
        "",
    ],
    article: [
        "braillelabel brailleroledescription label labelledby posinset roledescription setsize",
        "",
    ],
    banner: [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    blockquote: [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    button: [
        "braillelabel brailleroledescription expanded label labelledby pressed roledescription",
        "",
    ],
    caption: ["brailleroledescription roledescription", ""],
    cell: [
        "braillelabel brailleroledescription colindex colindextext colspan label labelledby roledescription rowindex rowindextext rowspan",
        "",
    ],
    checkbox: [
        "braillelabel brailleroledescription checked expanded label labelledby readonly required roledescription",
        "checked",
    ],
    code: ["brailleroledescription roledescription", ""],
    columnheader: [
        "braillelabel brailleroledescription colindex colindextext colspan expanded label labelledby readonly required roledescription rowindex rowindextext rowspan selected sort",
        "",
    ],
    combobox: [
        "activedescendant autocomplete braillelabel brailleroledescription expanded label labelledby readonly required roledescription",
        "expanded",
    ],
    complementary: [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    contentinfo: [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    definition: ["brailleroledescription roledescription", ""],
    deletion: ["brailleroledescription roledescription", ""],
    dialog: [
        "braillelabel brailleroledescription label labelledby modal roledescription",
        "",
    ],
    directory: [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    document: [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    emphasis: ["brailleroledescription roledescription", ""],
    feed: [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    figure: [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    form: [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    generic: ["", ""],
    grid: [
        "activedescendant braillelabel brailleroledescription colcount label labelledby multiselectable readonly roledescription rowcount",
        "",
    ],
    gridcell: [
        "braillelabel brailleroledescription colindex colindextext colspan expanded label labelledby readonly required roledescription rowindex rowindextext rowspan selected",
        "",
    ],
    group: [
        "activedescendant braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    heading: [
        "braillelabel brailleroledescription label labelledby level roledescription",
        "level",
    ],
    img: [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    image: [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    insertion: ["brailleroledescription roledescription", ""],
    link: [
        "braillelabel brailleroledescription expanded label labelledby roledescription",
        "",
    ],
    list: [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    listbox: [
        "activedescendant braillelabel brailleroledescription expanded label labelledby multiselectable orientation readonly required roledescription",
        "",
    ],
    listitem: [
        "braillelabel brailleroledescription label labelledby posinset roledescription setsize",
        "",
    ],
    log: [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    main: [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    mark: ["brailleroledescription roledescription", ""],
    marquee: [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    math: [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    menu: [
        "activedescendant braillelabel brailleroledescription label labelledby orientation roledescription",
        "",
    ],
    menubar: [
        "activedescendant braillelabel brailleroledescription label labelledby orientation roledescription",
        "",
    ],
    menuitem: [
        "braillelabel brailleroledescription expanded label labelledby posinset roledescription setsize",
        "",
    ],
    menuitemcheckbox: [
        "braillelabel brailleroledescription checked expanded label labelledby posinset roledescription setsize",
        "checked",
    ],
    menuitemradio: [
        "braillelabel brailleroledescription checked expanded label labelledby posinset roledescription setsize",
        "checked",
    ],
    meter: [
        "braillelabel brailleroledescription label labelledby roledescription valuemax valuemin valuenow valuetext",
        "valuenow",
    ],
    navigation: [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    none: ["brailleroledescription roledescription", ""],
    note: [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    option: [
        "braillelabel brailleroledescription checked label labelledby posinset roledescription selected setsize",
        "",
    ],
    paragraph: ["brailleroledescription roledescription", ""],
    presentation: [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    progressbar: [
        "braillelabel brailleroledescription label labelledby roledescription valuemax valuemin valuenow valuetext",
        "",
    ],
    radio: [
        "braillelabel brailleroledescription checked label labelledby posinset roledescription setsize",
        "checked",
    ],
    radiogroup: [
        "activedescendant braillelabel brailleroledescription label labelledby orientation readonly required roledescription",
        "",
    ],
    region: [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    row: [
        "activedescendant braillelabel brailleroledescription colindex expanded label labelledby level posinset roledescription rowindex rowindextext selected setsize",
        "",
    ],
    rowgroup: [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    rowheader: [
        "braillelabel brailleroledescription colindex colindextext colspan expanded label labelledby readonly required roledescription rowindex rowindextext rowspan selected sort",
        "",
    ],
    scrollbar: [
        "braillelabel brailleroledescription label labelledby orientation roledescription valuemax valuemin valuenow valuetext",
        "controls valuenow",
    ],
    search: [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    searchbox: [
        "activedescendant autocomplete braillelabel brailleroledescription label labelledby multiline placeholder readonly required roledescription",
        "",
    ],
    separator: [
        "braillelabel brailleroledescription label labelledby orientation roledescription valuemax valuemin valuenow valuetext",
        "",
    ],
    slider: [
        "braillelabel brailleroledescription label labelledby orientation readonly roledescription valuemax valuemin valuenow valuetext",
        "valuenow",
    ],
    spinbutton: [
        "activedescendant braillelabel brailleroledescription label labelledby readonly required roledescription valuemax valuemin valuenow valuetext",
        "",
    ],
    status: [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    strong: ["brailleroledescription roledescription", ""],
    subscript: ["brailleroledescription roledescription", ""],
    superscript: ["brailleroledescription roledescription", ""],
    switch: [
        "braillelabel brailleroledescription checked expanded label labelledby readonly required roledescription",
        "checked",
    ],
    tab: [
        "braillelabel brailleroledescription expanded label labelledby posinset roledescription selected setsize",
        "",
    ],
    table: [
        "braillelabel brailleroledescription colcount label labelledby roledescription rowcount",
        "",
    ],
    tablist: [
        "activedescendant braillelabel brailleroledescription label labelledby multiselectable orientation roledescription",
        "",
    ],
    tabpanel: [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    term: ["brailleroledescription roledescription", ""],
    textbox: [
        "activedescendant autocomplete braillelabel brailleroledescription label labelledby multiline placeholder readonly required roledescription",
        "",
    ],
    time: ["brailleroledescription roledescription", ""],
    timer: [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    toolbar: [
        "activedescendant braillelabel brailleroledescription label labelledby orientation roledescription",
        "",
    ],
    tooltip: [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    tree: [
        "activedescendant braillelabel brailleroledescription label labelledby multiselectable orientation required roledescription",
        "",
    ],
    treegrid: [
        "activedescendant braillelabel brailleroledescription colcount label labelledby multiselectable orientation readonly required roledescription rowcount",
        "",
    ],
    treeitem: [
        "braillelabel brailleroledescription checked expanded label labelledby level posinset roledescription selected setsize",
        "",
    ],
    comment: [
        "braillelabel brailleroledescription label labelledby level posinset roledescription setsize",
        "",
    ],
    suggestion: ["brailleroledescription roledescription", ""],
    "doc-abstract": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-acknowledgments": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-afterword": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-appendix": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-backlink": [
        "braillelabel brailleroledescription expanded label labelledby roledescription",
        "",
    ],
    "doc-biblioentry": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-bibliography": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-biblioref": [
        "braillelabel brailleroledescription expanded label labelledby roledescription",
        "",
    ],
    "doc-chapter": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-colophon": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-conclusion": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-cover": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-credit": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-credits": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-dedication": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-endnote": [
        "braillelabel brailleroledescription label labelledby posinset roledescription setsize",
        "",
    ],
    "doc-endnotes": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-epigraph": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-epilogue": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-errata": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-example": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-footnote": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-foreword": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-glossary": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-glossref": [
        "braillelabel brailleroledescription expanded label labelledby roledescription",
        "",
    ],
    "doc-index": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-introduction": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-noteref": [
        "braillelabel brailleroledescription expanded label labelledby roledescription",
        "",
    ],
    "doc-notice": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-pagebreak": [
        "braillelabel brailleroledescription label labelledby orientation roledescription valuemax valuemin valuenow valuetext",
        "",
    ],
    "doc-pagefooter": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-pageheader": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-pagelist": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-part": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-preface": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-prologue": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-pullquote": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-qna": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-subtitle": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-tip": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "doc-toc": [
        "braillelabel brailleroledescription label labelledby roledescription",
        "",
    ],
    "graphics-document": [
        "braillelabel brailleroledescription expanded label labelledby roledescription",
        "",
    ],
    "graphics-object": [
        "activedescendant braillelabel brailleroledescription expanded label labelledby roledescription",
        "",
    ],
    "graphics-symbol": [
        "braillelabel brailleroledescription expanded label labelledby roledescription",
        "",
    ],
};

export const roles = new Set(Object.keys(definitions));

const list = (text: string | undefined) => (text ? text.split(" ") : []);

/** The attributes a role supports, global ones included. */
export const supported = (role: string): Set<string> =>
    new Set([...globalProperties, ...list(definitions[role]?.[0])]);

/** The attributes a role requires. */
export const required = (role: string): string[] =>
    list(definitions[role]?.[1]);

/** Roles of widgets users interact with. */
export const interactiveRoles = new Set(
    `
        button checkbox columnheader combobox grid gridcell link
        listbox menu menubar menuitem menuitemcheckbox menuitemradio
        option radio radiogroup row rowheader scrollbar searchbox
        separator slider spinbutton switch tab tablist textbox tree
        treegrid treeitem doc-backlink doc-biblioref doc-glossref
        doc-noteref doc-pagebreak
    `
        .trim()
        .split(/\s+/),
);

/** Roles of content and containers. */
export const nonInteractiveRoles = new Set(
    `
        alert alertdialog application article banner blockquote
        caption cell code complementary contentinfo definition
        deletion dialog directory document emphasis feed figure form
        generic group heading img image insertion list listitem log
        main mark marquee math meter navigation none note paragraph
        presentation progressbar region rowgroup search status
        strong subscript superscript table tabpanel term time timer
        tooltip comment suggestion doc-abstract doc-acknowledgments
        doc-afterword doc-appendix doc-biblioentry doc-bibliography
        doc-chapter doc-colophon doc-conclusion doc-cover doc-credit
        doc-credits doc-dedication doc-endnote doc-endnotes doc-epigraph doc-epilogue doc-errata doc-example doc-footnote
        doc-foreword doc-glossary doc-index doc-introduction doc-notice doc-pagefooter doc-pageheader doc-pagelist doc-part
        doc-preface doc-prologue doc-pullquote doc-qna doc-subtitle
        doc-tip doc-toc graphics-document graphics-object graphics-symbol
    `
        .trim()
        .split(/\s+/),
);

/** Implicit roles of elements without attributes that change them. */
const implicitRoles: Record<string, string> = {
    a: "generic",
    address: "group",
    area: "generic",
    article: "article",
    aside: "complementary",
    b: "generic",
    bdi: "generic",
    bdo: "generic",
    blockquote: "blockquote",
    body: "generic",
    button: "button",
    caption: "caption",
    code: "code",
    data: "generic",
    datalist: "listbox",
    dd: "definition",
    del: "deletion",
    details: "group",
    dfn: "term",
    dialog: "dialog",
    div: "generic",
    dt: "term",
    em: "emphasis",
    fieldset: "group",
    figcaption: "caption",
    figure: "figure",
    footer: "generic",
    form: "form",
    h1: "heading",
    h2: "heading",
    h3: "heading",
    h4: "heading",
    h5: "heading",
    h6: "heading",
    header: "generic",
    hgroup: "group",
    hr: "separator",
    i: "generic",
    img: "img",
    input: "textbox",
    ins: "insertion",
    legend: "caption",
    li: "listitem",
    link: "generic",
    main: "main",
    mark: "mark",
    math: "math",
    menu: "list",
    meter: "meter",
    nav: "navigation",
    ol: "list",
    optgroup: "group",
    option: "option",
    output: "status",
    p: "paragraph",
    pre: "generic",
    progress: "progressbar",
    q: "generic",
    s: "deletion",
    samp: "generic",
    search: "search",
    section: "generic",
    select: "combobox",
    small: "generic",
    span: "generic",
    strong: "strong",
    sub: "subscript",
    sup: "superscript",
    svg: "graphics-document",
    table: "table",
    tbody: "rowgroup",
    td: "cell",
    textarea: "textbox",
    tfoot: "rowgroup",
    th: "rowheader",
    thead: "rowgroup",
    time: "time",
    tr: "row",
    u: "generic",
    ul: "list",
};

/** Roles not reported as the only role, like `img` for a picture made of other elements. */
export const semanticExceptions = new Set([
    "combobox",
    "img",
    "listbox",
    "option",
    "status",
]);

/** Elements that are semantic alternatives to roles. */
export const semanticElements: Record<string, string[]> = {
    combobox: ["select"],
    img: ["img"],
    listbox: ["select"],
    option: ["option"],
    status: ["output"],
    article: ["article"],
    banner: ["header"],
    blockquote: ["blockquote"],
    button: ["button"],
    caption: ["caption", "figcaption", "legend"],
    cell: ["td"],
    checkbox: ['input type="checkbox"'],
    code: ["code"],
    columnheader: ['th scope="col"'],
    complementary: ["aside"],
    contentinfo: ["footer"],
    deletion: ["del", "s"],
    emphasis: ["em"],
    figure: ["figure"],
    form: ["form"],
    grid: ["table"],
    gridcell: ["td"],
    group: ["fieldset"],
    heading: ["h1", "h2", "h3", "h4", "h5", "h6"],
    insertion: ["ins"],
    link: ["a", "link"],
    list: ["ol", "ul"],
    listitem: ["li"],
    main: ["main"],
    mark: ["mark"],
    meter: ["meter"],
    navigation: ["nav"],
    paragraph: ["p"],
    radio: ['input type="radio"'],
    region: ["section"],
    row: ["tr"],
    rowgroup: ["tbody", "tfoot", "thead"],
    rowheader: ['th scope="row"'],
    search: ["search"],
    searchbox: ['input type="search"'],
    separator: ["hr"],
    strong: ["strong"],
    subscript: ["sub", "sup"],
    superscript: ["sub", "sup"],
    table: ["table"],
    term: ["dfn"],
    textbox: ['input type="text"', "textarea"],
    time: ["time"],
};

/** The implicit role of an intrinsic element, like `link` for `<a href>`. */
export function implicitRole(element: Element): string | undefined {
    const name = element.name ?? "";
    const has = (attribute: string) =>
        Jsx.attribute(element, attribute) !== undefined;
    const text = (attribute: string): string | undefined => {
        const found = Jsx.attribute(element, attribute);
        const value = found && Jsx.value(found);
        return typeof value === "string" ? value : undefined;
    };
    switch (name) {
        case "a":
        case "area":
            return has("href") ? "link" : "generic";
        case "img":
            return text("alt") === "" &&
                !has("aria-label") &&
                !has("aria-labelledby")
                ? "presentation"
                : "img";
        case "input": {
            const type = (text("type") ?? "text").toLowerCase();
            if (["button", "image", "reset", "submit"].includes(type))
                return "button";
            if (type === "checkbox" || type === "radio") return type;
            if (type === "range") return "slider";
            if (type === "number") return "spinbutton";
            if (
                [
                    "color",
                    "date",
                    "datetime-local",
                    "file",
                    "hidden",
                    "month",
                    "password",
                    "time",
                    "week",
                ].includes(type)
            )
                return;
            if (has("list")) return "combobox";
            return type === "search" ? "searchbox" : "textbox";
        }
        case "select": {
            const size = Number(text("size") ?? "");
            return has("multiple") || size > 1 ? "listbox" : "combobox";
        }
        case "section":
            return has("aria-label") || has("aria-labelledby") || has("title")
                ? "region"
                : "generic";
        case "th":
            return text("scope") === "col" ? "columnheader" : "rowheader";
        default:
            return implicitRoles[name];
    }
}

/** Elements Biome treats as interactive, never to be given non-interactive roles. */
const interactiveElements = new Set(
    `
        abbr area audio button canvas cite col colgroup datalist dl
        embed head header hr input kbd map noscript object option
        picture rp rt select slot summary template textarea th tr
        track var video wbr
    `
        .trim()
        .split(/\s+/),
);

/** Whether an element is interactive, like `<button>`, `<a href>` or `<input>`. */
export function interactiveElement(element: Element): boolean {
    const name = element.name ?? "";
    if (name === "a") return Jsx.attribute(element, "href") !== undefined;
    if (name === "input") {
        const type = Jsx.attribute(element, "type");
        const value = type && Jsx.value(type);
        return value !== "hidden";
    }
    return interactiveElements.has(name);
}

/** Elements Biome treats as non-interactive content, besides `<div>` and `<span>`. */
const nonInteractiveElements = new Set(
    `
        address article aside b bdi bdo blockquote body br caption
        code data dd del details dfn dialog dt em fieldset
        figcaption figure footer form h1 h2 h3 h4 h5 h6 hgroup i
        iframe img ins label legend li link main mark math menu
        meter nav ol optgroup output p pre progress q ruby s samp
        search section small strong sub sup svg table tbody td tfoot
        thead time u ul
    `
        .trim()
        .split(/\s+/),
);

/** Whether an element is non-interactive content, like `<h1>`, `<li>` or `<img>`. */
export function nonInteractiveElement(element: Element): boolean {
    const name = element.name ?? "";
    if (name === "input") return !interactiveElement(element);
    return nonInteractiveElements.has(name);
}

/** The first role of an element's `role` attribute, if written as a string. */
export function explicitRole(element: Element): string | undefined {
    const value = text(attribute(element, "role"));
    return value === undefined ? undefined : tokens(value)[0];
}

/** The first attribute of an element with a name. */
export const attribute = (
    element: Element,
    name: string,
): Attribute | undefined =>
    element.attributes.find(
        (candidate): candidate is Attribute =>
            candidate.type === "JSXAttribute" && candidate.name === name,
    );

/** The text of an attribute set to a string, also through `{"..."}` or a plain template. */
export const text = (found: Attribute | undefined): string | undefined => {
    if (!found?.value) return;
    let value: Node | null = found.value;
    if (value.type === "JSXExpressionContainer") value = value.expression;
    if (value?.type === "StringLiteral") return value.raw.slice(1, -1);
    if (value?.type === "TemplateLiteral" && value.expressions.length === 0)
        return value.quasis[0]?.raw;
};

/** The roles of a `role` attribute, like `["button", "link"]`. */
export const tokens = (value: string): string[] =>
    value
        .trim()
        .split(/\s+/)
        .filter((token) => token !== "");
