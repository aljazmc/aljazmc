import { rule } from "../../rules.js";

/** Obsolete elements known as tags. */
const tags = new Set(
    "acronym basefont bgsound big blink center dir font frame frameset keygen marquee menuitem nobr noembed noframes plaintext rb rtc strike tt xmp".split(
        " ",
    ),
);

/** Obsolete elements not known as tags, by their lower case name. */
const unknown = new Set(
    "applet isindex listing multicol nextid spacer".split(" "),
);

export default rule({
    name: "noObsoleteTags",
    group: "nursery",
    severity: "warn",
    recommended: false,
    fix: "none",
    languages: ["html"],
    create: (context) => ({
        HtmlElement(node) {
            const obsolete = node.tag
                ? tags.has(node.tag)
                : unknown.has(node.name.toLowerCase());
            if (obsolete)
                context.report(
                    {
                        start: node.start + 1,
                        end: node.start + 1 + node.name.length,
                    },
                    `The ${node.name} element is obsolete.`,
                );
        },
    }),
});
