import Jsx from "../../analysis/jsx.js";
import { rule } from "../../rules.js";

export default rule({
    name: "useGoogleFontPreconnect",
    group: "performance",
    severity: "info",
    recommended: false,
    fix: "safe",
    languages: ["jsx"],
    domains: { next: "recommended" },
    create: (context) => ({
        JSXElement(node) {
            if (node.name !== "link") return;
            const href = Jsx.attribute(node, "href");
            if (
                href?.value?.type !== "StringLiteral" ||
                !href.value.raw
                    .slice(1, -1)
                    .startsWith("https://fonts.gstatic.com")
            )
                return;
            const rel = Jsx.attribute(node, "rel");
            if (
                rel?.value?.type === "StringLiteral" &&
                rel.value.raw.slice(1, -1) === "preconnect"
            )
                return;
            const last = node.attributes.at(-1);
            context.report(
                node,
                'The attribute rel="preconnect" is missing from the Google Font.',
                rel || !last
                    ? undefined
                    : {
                          message: 'Add the rel="preconnect" attribute.',
                          edits: [
                              {
                                  start: last.end,
                                  end: last.end,
                                  text: '  rel="preconnect"',
                              },
                          ],
                      },
            );
        },
    }),
});
