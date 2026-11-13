import type { Html as Tree } from "@aljazmc/syntax";
import type { Range } from "./context.js";
import { fromRoles, isNonInteractive } from "./roles.js";
import table from "./table.js";

/** An element as the ARIA queries see it. */
export interface AriaElement {
    /** The name, lower case for HTML elements. */
    name: string | undefined;
    /** The static value of the first attribute named exactly so, undefined when it has none. */
    attribute(name: string): { value: string | undefined } | undefined;
}

/** Event handlers by type, without `on`. */
const handlers: Record<string, string[]> = table({
    animation: ["animationend", "animationiteration", "animationstart"],
    clipboard: ["copy", "cut", "paste"],
    composition: ["compositionend", "compositionstart", "compositionupdate"],
    focus: ["blur", "focus"],
    form: ["change", "input", "submit"],
    image: ["error", "load"],
    keyboard: ["keydown", "keypress", "keyup"],
    media: [
        "abort",
        "canplay",
        "canplaythrough",
        "durationchange",
        "emptied",
        "encrypted",
        "ended",
        "error",
        "loadeddata",
        "loadedmetadata",
        "loadstart",
        "pause",
        "play",
        "playing",
        "progress",
        "ratechange",
        "seeked",
        "seeking",
        "stalled",
        "suspend",
        "timeupdate",
        "volumechange",
        "waiting",
    ],
    mouse: [
        "click",
        "contextmenu",
        "dblclick",
        "doubleclick",
        "drag",
        "dragend",
        "dragenter",
        "dragexit",
        "dragleave",
        "dragover",
        "dragstart",
        "drop",
        "mousedown",
        "mouseenter",
        "mouseleave",
        "mousemove",
        "mouseout",
        "mouseover",
        "mouseup",
    ],
    selection: ["select"],
    touch: ["touchcancel", "touchend", "touchmove", "touchstart"],
    transition: ["transitionend"],
    ui: ["scroll"],
    wheel: ["wheel"],
});

/** Whether an attribute name, like `onClick` or `onclick`, handles events of the types. */
export function eventHandler(types: string[], name: string): boolean {
    let event = name.toLowerCase();
    if (event.startsWith("on")) event = event.slice(2);
    return types.some((type) => handlers[type]?.includes(event) ?? false);
}

const quoted = (text: string) =>
    text.length >= 2 &&
    ((text.startsWith('"') && text.endsWith('"')) ||
        (text.startsWith("'") && text.endsWith("'")));

/** Helpers for the elements and attributes of HTML files. */
// biome-ignore lint/complexity/noStaticOnlyClass: groups HTML helpers
export default class Html {
    /** The first attribute with a name, ignoring ASCII case. */
    static attribute(
        element: Tree.Element,
        name: string,
    ): Tree.Attribute | undefined {
        const lower = name.toLowerCase();
        return element.attributes.find(
            (attribute) => attribute.name.toLowerCase() === lower,
        );
    }

    static has(element: Tree.Element, name: string): boolean {
        return Html.attribute(element, name) !== undefined;
    }

    /**
     * The static value of an attribute, undefined without a value. It
     * drops the first and last characters of every value, quoted or
     * not, then quotes left around it.
     */
    static value(attribute: Tree.Attribute | undefined): string | undefined {
        const raw = attribute?.value?.raw;
        if (raw === undefined) return;
        const inner = raw.length >= 2 ? raw.slice(1, -1) : raw;
        return quoted(inner) ? inner.slice(1, -1) : inner;
    }

    /** The text of an attribute's value without its quotes, undefined without a value. */
    static text(attribute: Tree.Attribute | undefined): string | undefined {
        const raw = attribute?.value?.raw;
        if (raw === undefined) return;
        return quoted(raw) ? raw.slice(1, -1) : raw;
    }

    /** The range of an element's opening tag, reported by most rules. */
    static opening(element: Tree.Element): Range {
        return { start: element.start, end: element.openingEnd };
    }

    /** Whether an attribute has a value that is not blank. */
    static nonEmpty(element: Tree.Element, name: string): boolean {
        const attribute = Html.attribute(element, name);
        if (!attribute?.value) return false;
        return (Html.value(attribute) ?? "").trim() !== "";
    }

    /** `aria-hidden` with a value that is not blank or `false`. */
    static truthyAriaHidden(element: Tree.Element): Tree.Attribute | undefined {
        const attribute = Html.attribute(element, "aria-hidden");
        const value = Html.value(attribute)?.trim();
        return value && value.toLowerCase() !== "false" ? attribute : undefined;
    }

    /** `aria-hidden="true"`, exactly. */
    static ariaHiddenTrue(element: Tree.Element): boolean {
        return Html.value(Html.attribute(element, "aria-hidden")) === "true";
    }

    /** Hidden by a truthy `aria-hidden`, or an `<input type="hidden">`. */
    static hiddenFromScreenReader(element: Tree.Element): boolean {
        if (Html.truthyAriaHidden(element)) return true;
        return (
            element.name === "input" &&
            Html.value(Html.attribute(element, "type"))?.toLowerCase() ===
                "hidden"
        );
    }

    static contentEditable(element: Tree.Element): boolean {
        return (
            Html.value(Html.attribute(element, "contenteditable")) === "true"
        );
    }

    /** Whether an attribute handles events of the types, like `onclick` for `mouse`. */
    static handles(element: Tree.Element, types: string[]): boolean {
        return element.attributes.some((attribute) =>
            eventHandler(types, attribute.name),
        );
    }

    /** The element as the ARIA queries see it: lower-cased, attributes by exact name. */
    static aria(element: Tree.Element): AriaElement {
        return {
            name: element.name.toLowerCase(),
            attribute: (name) => {
                const found = element.attributes.find(
                    (attribute) => attribute.name === name,
                );
                return found && { value: Html.value(found) };
            },
        };
    }
}

/** The ARIA queries shared by the JSX and HTML rules. */
// biome-ignore lint/complexity/noStaticOnlyClass: groups ARIA queries
export class AriaRoles {
    static implicitRole(element: AriaElement): string | undefined {
        const value = (name: string) => element.attribute(name)?.value;
        const has = (name: string) => element.attribute(name) !== undefined;
        const named = () =>
            has("aria-labelledby") || has("aria-label") || has("title");
        switch (element.name) {
            case undefined:
                return;
            case "article":
                return "article";
            case "aside":
                return "complementary";
            case "blockquote":
                return "blockquote";
            case "button":
                return "button";
            case "caption":
            case "figcaption":
            case "legend":
                return "caption";
            case "code":
                return "code";
            case "datalist":
                return "listbox";
            case "del":
            case "s":
                return "deletion";
            case "dd":
                return "definition";
            case "dt":
            case "dfn":
                return "term";
            case "mark":
                return "mark";
            case "dialog":
                return "dialog";
            case "em":
                return "emphasis";
            case "figure":
                return "figure";
            case "form":
                return "form";
            case "hr":
                return "separator";
            case "html":
                return "document";
            case "ins":
                return "insertion";
            case "main":
                return "main";
            case "marquee":
                return "marquee";
            case "math":
                return "math";
            case "menu":
                return "list";
            case "menuitem": {
                const type = value("type");
                return type === "checkbox"
                    ? "menuitemcheckbox"
                    : type === "radio"
                      ? "menuitemradio"
                      : "menuitem";
            }
            case "meter":
                return "meter";
            case "nav":
                return "navigation";
            case "ul":
            case "ol":
                return "list";
            case "li":
                return "listitem";
            case "option":
                return "option";
            case "hgroup":
            case "optgroup":
                return "group";
            case "output":
                return "status";
            case "p":
                return "paragraph";
            case "progress":
                return "progressbar";
            case "search":
                return "search";
            case "strong":
                return "strong";
            case "sub":
                return "subscript";
            case "sup":
                return "superscript";
            case "svg":
                return "graphics-document";
            case "table":
                return "table";
            case "textarea":
                return "textbox";
            case "tr":
                return "row";
            case "td":
                return "cell";
            case "th":
                return value("scope") === "col" ? "columnheader" : "rowheader";
            case "time":
                return "time";
            case "address":
            case "details":
            case "fieldset":
                return "group";
            case "h1":
            case "h2":
            case "h3":
            case "h4":
            case "h5":
            case "h6":
                return "heading";
            case "tbody":
            case "tfoot":
            case "thead":
                return "rowgroup";
            case "input": {
                const type = value("type");
                switch (type) {
                    case "checkbox":
                        return "checkbox";
                    case "number":
                        return "spinbutton";
                    case "radio":
                        return "radio";
                    case "range":
                        return "slider";
                    case "button":
                    case "image":
                    case "reset":
                    case "submit":
                        return "button";
                    case "search":
                        return has("list") ? "combobox" : "searchbox";
                    case "color":
                    case "date":
                    case "datetime-local":
                    case "file":
                    case "hidden":
                    case "month":
                    case "password":
                    case "time":
                    case "week":
                        return;
                    default:
                        return has("list") ? "combobox" : "textbox";
                }
            }
            case "a":
            case "area":
            case "link":
                return has("href") ? "link" : "generic";
            case "img": {
                if (!has("alt")) return "img";
                const alt = value("alt");
                if (alt === undefined) return "img";
                if (alt.trim() !== "") return "img";
                return named() ? "img" : "presentation";
            }
            case "section":
                return named() ? "region" : "generic";
            case "select": {
                const size = value("size");
                let number = 0;
                if (size !== undefined) {
                    if (!/^[+-]?\d+$/.test(size)) return;
                    number = Number(size);
                }
                return !has("multiple") && number <= 1 ? "combobox" : "listbox";
            }
            case "b":
            case "bdi":
            case "bdo":
            case "body":
            case "data":
            case "div":
            case "i":
            case "q":
            case "samp":
            case "small":
            case "span":
            case "u":
            case "pre":
            case "header":
            case "footer":
                return "generic";
            default:
                return;
        }
    }

    static isNotInteractiveElement(element: AriaElement): boolean {
        switch (element.name) {
            case "header":
            case "a":
            case "area":
                return false;
            case "svg":
            case "body":
            case "br":
            case "details":
            case "dir":
            case "frame":
            case "iframe":
            case "label":
            case "mark":
            case "marquee":
            case "menu":
            case "meter":
            case "optgroup":
            case "pre":
            case "progress":
            case "ruby":
                return true;
            case "input":
                return element.attribute("type")?.value === "hidden";
            default: {
                const role = AriaRoles.implicitRole(element);
                return role !== undefined && isNonInteractive(role);
            }
        }
    }

    /** The role of the `role` attribute, or the implicit one. */
    static roleByElementName(element: AriaElement): string | undefined {
        const value = element.attribute("role")?.value;
        return (
            (value === undefined ? undefined : fromRoles(value)) ??
            AriaRoles.implicitRole(element)
        );
    }

    static isNotStaticElement(element: AriaElement): boolean {
        switch (element.name) {
            case "canvas":
            case "embed":
            case "iframe":
            case "video":
            case "audio":
            case "input":
            case "dl":
            case "label":
            case "legend":
            case "ruby":
            case "pre":
            case "figcaption":
            case "br":
                return true;
            case "s":
            case "hgroup":
            case "meta":
            case "base":
            case "title":
            case "basefont":
            case "head":
            case "script":
            case "noscript":
            case "template":
            case "style":
                return false;
            default: {
                const role = AriaRoles.roleByElementName(element);
                return (
                    role !== undefined &&
                    role !== "presentation" &&
                    role !== "generic"
                );
            }
        }
    }

    static isPresentationRole(element: AriaElement): boolean {
        const value = element.attribute("role")?.value;
        return value === "presentation" || value === "none";
    }

    static hasNameRequiredImageRole(element: AriaElement): boolean {
        const role = AriaRoles.roleByElementName(element);
        return (
            role === "img" ||
            role === "image" ||
            role === "graphics-document" ||
            role === "graphics-symbol"
        );
    }
}
