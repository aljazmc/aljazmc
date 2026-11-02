import Html from "../../analysis/html.js";
import { rule } from "../../rules.js";

type Token = { value: string; dot: boolean };

const wildcards = ["audio/*", "image/*", "video/*"];

/** Renamed MIME types and their standard names. */
const renamed: Record<string, string> = {
    "application/x-rar-compressed": "application/vnd.rar",
    "application/x-zip-compressed": "application/zip",
    "image/jpg": "image/jpeg",
    "image/svg": "image/svg+xml",
    "image/x-icon": "image/vnd.microsoft.icon",
};

const invalidExtension = (value: string) => /[\s,/*${}]/u.test(value);
const httpToken = (value: string) =>
    /^[A-Za-z0-9_!#$%&*+\-.^`|~']+$/.test(value);

/** The canonical form of an accept token, or undefined when invalid. */
function canonical(token: string): Token | undefined {
    if (token.startsWith(".")) {
        const extension = token.slice(1);
        return extension !== "" && !invalidExtension(extension)
            ? { value: token, dot: false }
            : undefined;
    }
    if (!token.includes("/"))
        return !invalidExtension(token)
            ? { value: token, dot: true }
            : undefined;
    const essence = (token.split(";")[0] ?? "").trim();
    if (essence.includes("*"))
        return wildcards.includes(essence.toLowerCase())
            ? { value: essence, dot: false }
            : undefined;
    const slash = essence.indexOf("/");
    const type = essence.slice(0, slash);
    const subtype = essence.slice(slash + 1);
    if (
        !type ||
        !subtype ||
        subtype.includes("/") ||
        !httpToken(type) ||
        !httpToken(subtype)
    )
        return undefined;
    return { value: renamed[essence.toLowerCase()] ?? essence, dot: false };
}

const text = ({ value, dot }: Token) => (dot ? "." : "") + value.toLowerCase();

/** Whether an accept value is valid, invalid, or valid but written in another form, then that form. */
function classify(
    source: string,
): "valid" | "invalid" | { normalized: string } {
    let normalize = false;
    const seen: string[] = [];
    for (const [index, raw] of source.split(",").entries()) {
        const token = raw.trim();
        if (token === "") return "invalid";
        const found = canonical(token);
        if (!found) return "invalid";
        const spaced = index === 0 ? raw === token : raw === ` ${token}`;
        const duplicate = seen.includes(text(found));
        normalize ||= !spaced || text(found) !== token || duplicate;
        if (!duplicate) seen.push(text(found));
    }
    return normalize ? { normalized: seen.join(", ") } : "valid";
}

export default rule({
    name: "noInvalidFileInputAccept",
    group: "nursery",
    severity: "error",
    recommended: false,
    fix: "unsafe",
    languages: ["html"],
    create: (context) => ({
        HtmlElement(node) {
            if (node.tag !== "input") return;
            const single = (name: string) =>
                node.attributes.filter(
                    (attribute) => attribute.name.toLowerCase() === name,
                ).length === 1;
            if (!single("type") || !single("accept")) return;
            const type = Html.attribute(node, "type");
            const accept = Html.attribute(node, "accept");
            if (!type?.value || !accept) return;
            const kind = Html.text(type) ?? "";
            if (kind.includes("&") || kind.toLowerCase() !== "file") return;
            if (!accept.value) {
                context.report(
                    accept,
                    "The file input accept attribute has no value.",
                );
                return;
            }
            const value = Html.text(accept) ?? "";
            if (value.includes("&")) return;
            const quoted = accept.value.quote !== "";
            const range =
                quoted && value !== ""
                    ? {
                          start: accept.value.start + 1,
                          end: accept.value.end - 1,
                      }
                    : accept.value;
            const result = classify(value);
            if (result === "valid") return;
            if (result === "invalid")
                context.report(
                    range,
                    "The file input accept value is invalid.",
                );
            else
                context.report(
                    range,
                    `Use ${result.normalized} as the file input accept value.`,
                    {
                        message: `Use ${result.normalized} as the file input accept value.`,
                        edits: [
                            {
                                start: accept.value.start,
                                end: accept.value.end,
                                text: `"${result.normalized}"`,
                            },
                        ],
                    },
                );
        },
    }),
});
